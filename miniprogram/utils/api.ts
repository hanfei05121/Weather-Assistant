// utils/api.ts
// API Host：每个和风天气账号独有，登录 https://console.qweather.com/setting 查看
// 原公共域名 devapi.qweather.com / geoapi.qweather.com 已从2026年起逐步停止服务，必须使用自己的 API Host
const API_HOST = 'nb6fr9kry3.re.qweatherapi.com'

const API_KEY = '0110bfbfdbbc4d4dbdec758f34d5d29d'
const BASE_URL = `https://${API_HOST}`
const TIMEOUT = 8000

// 城市ID本地映射（未命中时通过 GeoAPI 动态查询）
const cityIds: Record<string, string> = {
  '南京': '101190101',
  '北京': '101010100',
  '上海': '101020100',
  '广州': '101280101',
  '深圳': '101280601',
  '杭州': '101210101',
  '成都': '101270101',
  '武汉': '101200101',
  '西安': '101110101',
  '重庆': '101040100'
}

// 已通过 GeoAPI 解析出的城市ID缓存
const locationCache: Record<string, string> = {}

// 通用请求方法
async function request(url: string, params: Record<string, string> = {}): Promise<any> {
  if (!API_HOST) {
    return Promise.reject(new Error('请先配置 API Host（utils/api.ts 中的 API_HOST 常量）'))
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: 'GET',
      timeout: TIMEOUT,
      data: {
        key: API_KEY,
        ...params
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = res.data as any
          if (data && data.code && data.code !== '200') {
            reject(new Error(`和风天气接口错误: code=${data.code}`))
          } else {
            resolve(res.data)
          }
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}

// 获取城市 LocationID：优先本地映射，其次 GeoAPI 查询并缓存
async function getCityId(city: string): Promise<string> {
  if (cityIds[city]) return cityIds[city]
  if (locationCache[city]) return locationCache[city]

  try {
    const result = await request(`${BASE_URL}/geo/v2/city/lookup`, { location: city, number: '1', range: 'cn' })
    const location = result.location && result.location[0]
    if (location) {
      locationCache[city] = location.id
      return location.id
    }
  } catch (error) {
    console.error('GeoAPI 查询失败:', error)
  }
  return cityIds['南京'] // 兜底默认南京
}

// 获取实时天气
export async function getWeatherNow(city: string) {
  const location = await getCityId(city)
  return request(`${BASE_URL}/v7/weather/now`, { location })
}

// 获取7天天气预报
export async function getWeather7d(city: string) {
  const location = await getCityId(city)
  return request(`${BASE_URL}/v7/weather/7d`, { location })
}

// 获取24小时天气预报
export async function getWeather24h(city: string) {
  const location = await getCityId(city)
  return request(`${BASE_URL}/v7/weather/24h`, { location })
}

// 搜索城市（限定中国范围，排除海外同名城市干扰）
export async function searchCity(keyword: string) {
  return request(`${BASE_URL}/geo/v2/city/lookup`, { location: keyword, range: 'cn' })
}
