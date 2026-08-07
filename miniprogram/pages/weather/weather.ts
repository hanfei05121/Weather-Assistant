// pages/weather/weather.ts
import { getWeatherNow, getWeather10d, getWeather24h, getWeatherAir, getWeatherIndices, getWeatherWarning, getCityByLocation, registerCityId } from '../../utils/api'
import { getCurrentCity, setCurrentCity, getAutoLocated, setAutoLocated, replaceLegacyLocationCity } from '../../utils/storage'
import { ThreeWeatherParticles } from '../../utils/three-particles'

interface WeatherData {
  city: string
  temperature: number
  feelsLike: number
  condition: string
  conditionCode: string
  high: number
  low: number
  humidity: number
  windSpeed: number
  windDir: string
  uvIndex: number
  visibility: number
  pressure: number
  sunrise: string
  sunset: string
}

// 统一深色背景（与详情页保持一致，保证图标凸显）
const WEATHER_BG = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'

interface HourlyData {
  hour: string
  temperature: number
  condition: string
  conditionCode: string
  precipitation: number
}

interface DailyData {
  date: string
  weekDay: string
  condition: string
  conditionCode: string
  high: number
  low: number
  precipitation: number
  barLeft: number
  barWidth: number
  barColorFrom: string
  barColorTo: string
}

Page({
  particles: null as ThreeWeatherParticles | null,

  data: {
    currentCity: '南京',
    weatherData: null as WeatherData | null,
    hourlyData: [] as HourlyData[],
    dailyData: [] as DailyData[],
    airData: null as any,
    indices: [] as any[],
    warnings: [] as any[],
    loading: true,
    error: '',
    currentDate: '',
    backgroundStyle: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    windDirDeg: 0,
    windForce: 0,
    sunArcPercent: 50,
    uvPercent: 50,
    compassTicks: [] as number[]
  },

  onLoad() {
    this.init()
  },

  // 首次进入：自动定位到"我的位置（市·区）"并设为当前城市；已定位过则直接加载
  // 遇到旧版裸"我的位置"数据时强制重新定位迁移
  async init() {
    if (!getAutoLocated() || getCurrentCity() === '我的位置') {
      await this.autoLocate()
    }
    this.loadWeatherData()
  },

  async autoLocate() {
    try {
      const loc = await this.getLocation()
      const city = await getCityByLocation(loc.latitude, loc.longitude)
      if (city) {
        const locName = `我的位置（${city.name}·${city.district}）`
        registerCityId(locName, city.id)
        replaceLegacyLocationCity(locName)
        setCurrentCity(locName)
        this.setData({ currentCity: locName })
      }
    } catch (error) {
      console.log('自动定位失败，使用当前城市:', error)
    }
    setAutoLocated(true)
  },

  getLocation(): Promise<{ latitude: number, longitude: number }> {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: reject
      })
    })
  },

  onReady() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#weather-canvas').fields({ node: true, size: true }).exec((res: any) => {
      const info = res && res[0]
      if (!info || !info.node) return
      const winInfo: any = (wx as any).getWindowInfo ? (wx as any).getWindowInfo() : wx.getSystemInfoSync()
      this.particles = new ThreeWeatherParticles()
      this.particles.init(info.node, info.width, info.height, winInfo.pixelRatio || 2)
      this.particles.start()
      if (this.data.weatherData) {
        this.particles.setWeather(this.data.weatherData.conditionCode)
      }
    })
  },

  onShow() {
    if (this.particles) this.particles.start()
    const currentCity = getCurrentCity()
    if (currentCity !== this.data.currentCity) {
      this.setData({ currentCity })
      this.loadWeatherData()
    }
  },

  onHide() {
    if (this.particles) this.particles.stop()
  },

  onUnload() {
    if (this.particles) {
      this.particles.destroy()
      this.particles = null
    }
  },

  async loadWeatherData() {
    this.setData({ loading: true, error: '' })
    
    try {
      const city = this.data.currentCity
      
      // 并行请求主要天气数据（辅助数据失败不阻塞主流程）
      const [nowRes, dailyRes, hourlyRes, airRes, indicesRes, warningRes] = await Promise.all([
        getWeatherNow(city),
        getWeather10d(city),
        getWeather24h(city),
        getWeatherAir(city).catch(() => null),
        getWeatherIndices(city).catch(() => null),
        getWeatherWarning(city).catch(() => null)
      ])

      // 处理实时天气数据
      const now = nowRes.now
      const daily = dailyRes.daily[0]
      
      const weatherData: WeatherData = {
        city: city,
        temperature: parseInt(now.temp),
        feelsLike: parseInt(now.feelsLike),
        condition: now.text,
        conditionCode: now.icon,
        high: parseInt(daily.tempMax),
        low: parseInt(daily.tempMin),
        humidity: parseInt(now.humidity),
        windSpeed: parseInt(now.windSpeed),
        windDir: now.windDir,
        uvIndex: parseInt(daily.uvIndex),
        visibility: parseInt(now.vis),
        pressure: parseInt(now.pressure),
        sunrise: daily.sunrise,
        sunset: daily.sunset
      }

      // 处理24小时预报数据
      const hourlyData: HourlyData[] = hourlyRes.hourly.slice(0, 24).map((item: any) => ({
        hour: item.fxTime.split('T')[1].substring(0, 5),
        temperature: parseInt(item.temp),
        condition: item.text,
        conditionCode: item.icon,
        precipitation: parseInt(item.pop)
      }))

      // 处理10天预报数据
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const dailyData: DailyData[] = dailyRes.daily.map((item: any, index: number) => {
        const parts = item.fxDate.split('-')
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        const weekDay = index === 0 ? '今天' : weekDays[date.getDay()]
        
        return {
          date: item.fxDate,
          weekDay: weekDay,
          condition: item.textDay,
          conditionCode: item.iconDay,
          high: parseInt(item.tempMax),
          low: parseInt(item.tempMin),
          precipitation: item.pop ? parseInt(item.pop) : 0
        }
      })

      const currentDate = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })

      // 处理空气质量
      let airData = null
      if (airRes && airRes.now) {
        airData = {
          aqi: airRes.now.aqi,
          category: airRes.now.category,
          pm25: airRes.now.pm2p5,
          pm10: airRes.now.pm10
        }
      }

      // 处理生活指数
      const indices = ((indicesRes && indicesRes.daily) || [])
        .map((item: any) => ({
          type: item.type,
          name: item.name,
          category: item.category,
          text: item.text ? item.text.slice(0, 24) : ''
        }))
        .slice(0, 4)

      // 处理预警信息
      const warnings = ((warningRes && warningRes.warning) || []).map((item: any) => ({
        id: item.id,
        severityColor: item.severityColor || '#ff4d4f',
        title: item.title,
        text: item.text ? item.text.slice(0, 40) : ''
      }))

      // 计算每日温度条位置（相对全局最低/最高温度）
      const allLows = dailyData.map(d => d.low)
      const allHighs = dailyData.map(d => d.high)
      const globalMin = Math.min(...allLows)
      const globalMax = Math.max(...allHighs)
      const globalRange = globalMax - globalMin || 1
      dailyData.forEach(d => {
        const left = ((d.low - globalMin) / globalRange) * 100
        const width = ((d.high - d.low) / globalRange) * 100
        d.barLeft = Math.round(left)
        d.barWidth = Math.max(8, Math.round(width))
        // 根据温度高低设置渐变色
        const ratio = (d.high - globalMin) / globalRange
        if (ratio < 0.33) {
          d.barColorFrom = '#4facfe'
          d.barColorTo = '#00f2fe'
        } else if (ratio < 0.66) {
          d.barColorFrom = '#f6d365'
          d.barColorTo = '#fda085'
        } else {
          d.barColorFrom = '#f093fb'
          d.barColorTo = '#f5576c'
        }
      })

      // 计算风向角度
      const windDirMap: Record<string, number> = {
        '北': 0, '东北': 45, '东': 90, '东南': 135,
        '南': 180, '西南': 225, '西': 270, '西北': 315,
        '北风': 0, '东北风': 45, '东风': 90, '东南风': 135,
        '南风': 180, '西南风': 225, '西风': 270, '西北风': 315
      }
      const windDirDeg = windDirMap[weatherData.windDir] ?? 0

      // 计算风力等级（蒲福风级，m/s）
      const ws = weatherData.windSpeed
      let windForce = 0
      if (ws >= 0.3) windForce = 1
      if (ws >= 1.6) windForce = 2
      if (ws >= 3.4) windForce = 3
      if (ws >= 5.5) windForce = 4
      if (ws >= 8.0) windForce = 5
      if (ws >= 10.8) windForce = 6
      if (ws >= 13.9) windForce = 7
      if (ws >= 17.2) windForce = 8
      if (ws >= 20.8) windForce = 9
      if (ws >= 24.5) windForce = 10
      if (ws >= 28.5) windForce = 11
      if (ws >= 32.7) windForce = 12

      // 计算日出日落弧线百分比
      let sunArcPercent = 50
      try {
        const now = Date.now()
        const today = new Date().toISOString().split('T')[0]
        const sunriseTime = new Date(`${today}T${weatherData.sunrise}:00`).getTime()
        const sunsetTime = new Date(`${today}T${weatherData.sunset}:00`).getTime()
        const dayLen = sunsetTime - sunriseTime
        if (dayLen > 0) {
          sunArcPercent = Math.max(0, Math.min(100, ((now - sunriseTime) / dayLen) * 100))
        }
      } catch (_) { /* ignore */ }

      // 计算紫外线百分比（UV 0-11+ 映射到 0-100%）
      const uvPercent = Math.min(100, Math.round((weatherData.uvIndex / 11) * 100))

      // 生成罗盘刻度（每5度一个刻度）
      const compassTicks: number[] = []
      for (let i = 0; i < 72; i++) {
        compassTicks.push(i * 5)
      }

      // 设置天气背景
      const backgroundStyle = WEATHER_BG

      this.setData({
        weatherData,
        hourlyData,
        dailyData,
        airData,
        indices,
        warnings,
        currentDate,
        backgroundStyle,
        windDirDeg,
        windForce,
        sunArcPercent,
        uvPercent,
        compassTicks,
        loading: false
      }, () => {
        if (this.particles) this.particles.setWeather(now.icon, parseInt(now.windSpeed) || 0)
      })
    } catch (error) {
      console.error('加载天气数据失败:', error)
      this.setData({
        loading: false,
        error: '加载天气数据失败，请稍后重试'
      })
    }
  },

  onPullDownRefresh() {
    this.loadWeatherData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onCityManage() {
    wx.navigateTo({
      url: '/pages/city/city'
    })
  },

  onHourlyTap(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    const hourData = this.data.hourlyData[index]
    
    wx.showModal({
      title: `${hourData.hour} 天气`,
      content: `温度: ${hourData.temperature}°C\n天气: ${hourData.condition}\n降水概率: ${hourData.precipitation}%`,
      showCancel: false
    })
  },

  onDailyTap(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    const dailyData = this.data.dailyData[index]
    
    wx.navigateTo({
      url: `/pages/detail/detail?date=${dailyData.date}&city=${this.data.currentCity}`
    })
  },

  onWeatherDetailTap(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type
    wx.navigateTo({
      url: `/pages/detail/detail?type=${type}&city=${this.data.currentCity}`
    })
  }
})