"use strict";
// app.ts
App({
    globalData: {
        apiKey: '0110bfbfdbbc4d4dbdec758f34d5d29d',
        baseUrl: 'https://nb6fr9kry3.re.qweatherapi.com'
    },
    onLaunch() {
        // 展示本地存储能力
        const logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);
        // 初始化城市列表
        const cities = wx.getStorageSync('weather_cities');
        if (!cities) {
            wx.setStorageSync('weather_cities', JSON.stringify(['南京', '北京', '上海']));
        }
        // 设置默认当前城市
        const currentCity = wx.getStorageSync('current_city');
        if (!currentCity) {
            wx.setStorageSync('current_city', '南京');
        }
    },
});
