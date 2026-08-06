// pages/detail/detail.ts
import { getWeatherNow, getWeather7d } from '../../utils/api'

interface DetailData {
  type: string
  title: string
  value: string
  unit: string
  description: string
  icon: string
}

Page({
  data: {
    city: '',
    date: '',
    type: '',
    detailData: null as DetailData | null,
    loading: true,
    error: ''
  },

  onLoad(options: any) {
    const { city, date, type } = options
    this.setData({ city: city || '南京', date, type })
    this.loadDetailData()
  },

  async loadDetailData() {
    this.setData({ loading: true, error: '' })
    
    try {
      const { city, date, type } = this.data
      
      if (date) {
        // 日期详情
        await this.loadDateDetail(city, date)
      } else if (type) {
        // 类型详情
        await this.loadTypeDetail(city, type)
      }
      
      this.setData({ loading: false })
    } catch (error) {
      console.error('加载详情数据失败:', error)
      this.setData({
        loading: false,
        error: '加载详情数据失败，请稍后重试'
      })
    }
  },

  async loadDateDetail(city: string, date: string) {
    const dailyRes = await getWeather7d(city)
    const dayData = dailyRes.daily.find((item: any) => item.fxDate === date)
    
    if (dayData) {
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const dateObj = new Date(date)
      const weekDay = weekDays[dateObj.getDay()]
      
      const detailData: DetailData = {
        type: 'date',
        title: `${date} ${weekDay}`,
        value: dayData.textDay,
        unit: '',
        description: `最高温度${dayData.tempMax}°C，最低温度${dayData.tempMin}°C`,
        icon: dayData.iconDay
      }
      
      this.setData({ detailData })
    }
  },

  async loadTypeDetail(city: string, type: string) {
    const nowRes = await getWeatherNow(city)
    const dailyRes = await getWeather7d(city)
    const daily = dailyRes.daily[0]
    
    let detailData: DetailData
    
    switch (type) {
      case 'feelslike':
        detailData = {
          type: 'feelslike',
          title: '体感温度',
          value: nowRes.now.feelsLike,
          unit: '°C',
          description: '体感温度考虑了风速、湿度等因素',
          icon: 'feelslike'
        }
        break
        
      case 'humidity':
        detailData = {
          type: 'humidity',
          title: '湿度',
          value: nowRes.now.humidity,
          unit: '%',
          description: '当前空气湿度',
          icon: 'humidity'
        }
        break
        
      case 'wind':
        detailData = {
          type: 'wind',
          title: '风',
          value: nowRes.now.windSpeed,
          unit: `km/h ${nowRes.now.windDir}`,
          description: `风力等级: ${nowRes.now.windScale}`,
          icon: 'wind'
        }
        break
        
      case 'sun':
        detailData = {
          type: 'sun',
          title: '日出日落',
          value: daily.sunrise,
          unit: `日落 ${daily.sunset}`,
          description: '日照时长计算',
          icon: 'sun'
        }
        break
        
      case 'visibility':
        detailData = {
          type: 'visibility',
          title: '能见度',
          value: nowRes.now.vis,
          unit: 'km',
          description: '当前能见度',
          icon: 'visibility'
        }
        break
        
      case 'pressure':
        detailData = {
          type: 'pressure',
          title: '气压',
          value: nowRes.now.pressure,
          unit: 'hPa',
          description: '当前气压',
          icon: 'pressure'
        }
        break
        
      case 'uv':
        detailData = {
          type: 'uv',
          title: '紫外线',
          value: daily.uvIndex,
          unit: '中等',
          description: '紫外线指数',
          icon: 'uv'
        }
        break
        
      default:
        detailData = {
          type: 'unknown',
          title: '未知',
          value: '',
          unit: '',
          description: '未知类型',
          icon: 'unknown'
        }
    }
    
    this.setData({ detailData })
  },

  onBack() {
    wx.navigateBack()
  }
})