// pages/mine/mine.ts
const AVATAR_KEY = 'user_avatar'
const NICK_KEY = 'user_nickname'

Page({
  data: {
    avatarUrl: '',
    nickname: '微信用户',
    version: 'v1.0.0'
  },

  onLoad() {
    this.setData({
      avatarUrl: wx.getStorageSync(AVATAR_KEY) || '',
      nickname: wx.getStorageSync(NICK_KEY) || '微信用户'
    })
  },

  // 选择头像（chooseAvatar）
  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const avatarUrl = e.detail.avatarUrl
    this.setData({ avatarUrl })
    wx.setStorageSync(AVATAR_KEY, avatarUrl)
  },

  // 填写昵称
  onNicknameChange(e: WechatMiniprogram.Input) {
    const nickname = (e.detail.value || '').trim()
    if (!nickname) return
    this.setData({ nickname })
    wx.setStorageSync(NICK_KEY, nickname)
  },

  // 天气提醒 → 系统首页天气页面
  onRemind() {
    wx.switchTab({ url: '/pages/weather/weather' })
  },

  // 台风追踪 → 台风页面
  onTyphoon() {
    wx.switchTab({ url: '/pages/typhoon/typhoon' })
  },

  onAbout() {
    wx.showToast({ title: `版本 ${this.data.version}`, icon: 'none' })
  }
})