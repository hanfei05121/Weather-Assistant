// pages/city/city.ts
import { getCityList, addCity, removeCity, setCurrentCity, replaceLegacyLocationCity } from '../../utils/storage'
import { searchCity, getCityByLocation, registerCityId } from '../../utils/api'

let searchTimer: any = null

Page({
  data: {
    cities: [] as string[],
    currentCity: '',
    searchKeyword: '',
    searchResults: [] as any[],
    isSearching: false
  },

  onLoad() {
    this.loadCities()
    this.upgradeLegacyLocation()
  },

  // 自动把旧版裸"我的位置"条目升级为"我的位置（市·区）"
  upgradeLegacyLocation() {
    if (!getCityList().includes('我的位置')) return
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        getCityByLocation(res.latitude, res.longitude).then((city) => {
          if (!city) return
          const displayName = `我的位置（${city.name}·${city.district}）`
          registerCityId(displayName, city.id)
          replaceLegacyLocationCity(displayName)
          this.loadCities()
        })
      },
      fail: () => {}
    })
  },

  onBack() {
    wx.navigateBack()
  },

  loadCities() {
    const cities = getCityList()
    const currentCity = getCurrentCity()
    this.setData({ cities, currentCity })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })

    if (searchTimer) clearTimeout(searchTimer)
    if (keyword.length > 0) {
      searchTimer = setTimeout(() => this.searchCity(keyword), 300)
    } else {
      this.setData({ searchResults: [], isSearching: false })
    }
  },

  async searchCity(keyword: string) {
    this.setData({ isSearching: true })

    try {
      const result = await searchCity(keyword)
      const searchResults = result.location || []
      this.setData({ searchResults, isSearching: false })
    } catch (error) {
      console.error('搜索城市失败:', error)
      this.setData({ isSearching: false })
    }
  },

  onSearchFocus() {
    this.setData({ isSearching: true })
  },

  onSearchBlur() {
    // 仅标记失焦，不隐藏搜索结果，避免用户点击结果时列表消失
    this.setData({ isSearching: false })
  },

  onAddCity(e: WechatMiniprogram.TouchEvent) {
    const city = e.currentTarget.dataset.city
    const name = e.currentTarget.dataset.name || city
    
    if (addCity(name)) {
      this.loadCities()
      // 清除搜索结果，保持列表状态
      this.setData({ searchKeyword: '', searchResults: [], isSearching: false })
      wx.showToast({
        title: `已添加${name}`,
        icon: 'success'
      })
    } else {
      wx.showToast({
        title: '该城市已存在',
        icon: 'none'
      })
    }
  },

  onSelectCity(e: WechatMiniprogram.TouchEvent) {
    const city = e.currentTarget.dataset.city
    setCurrentCity(city)
    
    wx.navigateBack()
  },

  onDeleteCity(e: WechatMiniprogram.TouchEvent) {
    const city = e.currentTarget.dataset.city
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除${city}吗？`,
      success: (res) => {
        if (res.confirm) {
          removeCity(city)
          this.loadCities()
          wx.showToast({
            title: `已删除${city}`,
            icon: 'success'
          })
        }
      }
    })
  },

  onUseCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        getCityByLocation(res.latitude, res.longitude).then((city) => {
          if (!city) {
            wx.showToast({
              title: '解析位置失败，请重试',
              icon: 'none'
            })
            return
          }
          const displayName = `我的位置（${city.name}·${city.district}）`
          // 注册显示名到真实城市ID的映射，保证天气按真实城市查询
          registerCityId(displayName, city.id)
          replaceLegacyLocationCity(displayName)
          setCurrentCity(displayName)
          this.loadCities()
          wx.showToast({
            title: '已添加当前位置',
            icon: 'success'
          })
        })
      },
      fail: () => {
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        })
      }
    })
  }
})

function getCurrentCity(): string {
  try {
    return wx.getStorageSync('current_city') || '南京'
  } catch (error) {
    return '南京'
  }
}