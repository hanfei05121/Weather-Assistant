// pages/weather/weather.ts
import { getWeatherNow, getWeather7d, getWeather24h } from '../../utils/api'
import { getCurrentCity } from '../../utils/storage'

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
}

Page({
  data: {
    currentCity: '南京',
    weatherData: null as WeatherData | null,
    hourlyData: [] as HourlyData[],
    dailyData: [] as DailyData[],
    loading: true,
    error: '',
    currentDate: '',
    backgroundStyle: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  },

  onLoad() {
    this.loadWeatherData()
  },

  onShow() {
    const currentCity = getCurrentCity()
    if (currentCity !== this.data.currentCity) {
      this.setData({ currentCity })
      this.loadWeatherData()
    }
  },

  async loadWeatherData() {
    this.setData({ loading: true, error: '' })
    
    try {
      const city = this.data.currentCity
      
      // 并行请求主要天气数据
      const [nowRes, dailyRes, hourlyRes] = await Promise.all([
        getWeatherNow(city),
        getWeather7d(city),
        getWeather24h(city)
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

      // 处理7天预报数据
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

      // 设置天气背景
      const backgroundStyle = WEATHER_BG

      this.setData({
        weatherData,
        hourlyData,
        dailyData,
        currentDate,
        backgroundStyle,
        loading: false
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