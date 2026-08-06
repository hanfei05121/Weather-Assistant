// utils/storage.ts

const STORAGE_KEY = 'weather_cities'
const CURRENT_CITY_KEY = 'current_city'

// 获取城市列表
export function getCityList(): string[] {
  try {
    const data = wx.getStorageSync(STORAGE_KEY)
    return data ? JSON.parse(data) : ['南京', '北京', '上海']
  } catch (error) {
    return ['南京', '北京', '上海']
  }
}

// 保存城市列表
export function saveCityList(cities: string[]): void {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(cities))
  } catch (error) {
    console.error('保存城市列表失败:', error)
  }
}

// 添加城市
export function addCity(city: string): boolean {
  const cities = getCityList()
  if (cities.includes(city)) {
    return false
  }
  cities.push(city)
  saveCityList(cities)
  return true
}

// 删除城市
export function removeCity(city: string): boolean {
  const cities = getCityList()
  const index = cities.indexOf(city)
  if (index === -1) {
    return false
  }
  cities.splice(index, 1)
  saveCityList(cities)
  return true
}

// 获取当前城市
export function getCurrentCity(): string {
  try {
    return wx.getStorageSync(CURRENT_CITY_KEY) || '南京'
  } catch (error) {
    return '南京'
  }
}

// 设置当前城市
export function setCurrentCity(city: string): void {
  try {
    wx.setStorageSync(CURRENT_CITY_KEY, city)
  } catch (error) {
    console.error('设置当前城市失败:', error)
  }
}

// 缓存天气数据
export function cacheWeatherData(city: string, data: any): void {
  try {
    const key = `weather_${city}_${Date.now()}`
    wx.setStorageSync(key, JSON.stringify(data))
  } catch (error) {
    console.error('缓存天气数据失败:', error)
  }
}

// 获取缓存的天气数据
export function getCachedWeatherData(city: string): any {
  try {
    // 这里简化处理，实际应该检查缓存有效期
    const keys = wx.getStorageInfoSync().keys
    const weatherKey = keys.find(key => key.startsWith(`weather_${city}_`))
    if (weatherKey) {
      const data = wx.getStorageSync(weatherKey)
      return JSON.parse(data)
    }
    return null
  } catch (error) {
    return null
  }
}