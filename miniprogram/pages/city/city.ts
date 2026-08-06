// pages/city/city.ts
import { getCityList, addCity, removeCity, setCurrentCity } from '../../utils/storage'
import { searchCity } from '../../utils/api'

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
      success: () => {
        // 这里可以根据经纬度获取城市名称
        // 简化处理，直接使用"我的位置"
        const city = '我的位置'
        if (addCity(city)) {
          setCurrentCity(city)
          this.loadCities()
          wx.showToast({
            title: '已添加当前位置',
            icon: 'success'
          })
        }
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