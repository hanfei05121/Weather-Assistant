// pages/mine/mine.ts
Page({
  data: {
    nickname: '微信用户',
    version: 'v1.0.0'
  },

  onAbout() {
    wx.showToast({ title: `版本 ${this.data.version}`, icon: 'none' })
  }
})
