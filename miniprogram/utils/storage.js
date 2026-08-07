"use strict";
// utils/storage.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCityList = getCityList;
exports.saveCityList = saveCityList;
exports.addCity = addCity;
exports.removeCity = removeCity;
exports.getCurrentCity = getCurrentCity;
exports.setCurrentCity = setCurrentCity;
exports.getAutoLocated = getAutoLocated;
exports.setAutoLocated = setAutoLocated;
exports.replaceLegacyLocationCity = replaceLegacyLocationCity;
exports.cacheWeatherData = cacheWeatherData;
exports.getCachedWeatherData = getCachedWeatherData;
const STORAGE_KEY = 'weather_cities';
const CURRENT_CITY_KEY = 'current_city';
const AUTO_LOCATED_KEY = 'auto_located';
// 获取城市列表
function getCityList() {
    try {
        const data = wx.getStorageSync(STORAGE_KEY);
        return data ? JSON.parse(data) : ['南京', '北京', '上海'];
    }
    catch (error) {
        return ['南京', '北京', '上海'];
    }
}
// 保存城市列表
function saveCityList(cities) {
    try {
        wx.setStorageSync(STORAGE_KEY, JSON.stringify(cities));
    }
    catch (error) {
        console.error('保存城市列表失败:', error);
    }
}
// 添加城市
function addCity(city) {
    const cities = getCityList();
    if (cities.includes(city)) {
        return false;
    }
    cities.push(city);
    saveCityList(cities);
    return true;
}
// 删除城市
function removeCity(city) {
    const cities = getCityList();
    const index = cities.indexOf(city);
    if (index === -1) {
        return false;
    }
    cities.splice(index, 1);
    saveCityList(cities);
    return true;
}
// 获取当前城市
function getCurrentCity() {
    try {
        return wx.getStorageSync(CURRENT_CITY_KEY) || '南京';
    }
    catch (error) {
        return '南京';
    }
}
// 设置当前城市
function setCurrentCity(city) {
    try {
        wx.setStorageSync(CURRENT_CITY_KEY, city);
    }
    catch (error) {
        console.error('设置当前城市失败:', error);
    }
}
// 是否已执行过首次自动定位（避免每次进入页面重复弹授权）
function getAutoLocated() {
    try {
        return !!wx.getStorageSync(AUTO_LOCATED_KEY);
    }
    catch (error) {
        return false;
    }
}
// 标记首次自动定位已处理（无论成功失败）
function setAutoLocated(value) {
    try {
        wx.setStorageSync(AUTO_LOCATED_KEY, value);
    }
    catch (error) {
        console.error('设置自动定位标记失败:', error);
    }
}
// 迁移旧版"我的位置"条目：从城市列表移除旧的裸"我的位置"，替换为新的定位城市名（如"我的位置（南京·玄武区）"）
function replaceLegacyLocationCity(replaceWith) {
    const cities = getCityList();
    if (!cities.includes('我的位置'))
        return;
    const next = cities.filter(city => city !== '我的位置');
    if (replaceWith && !next.includes(replaceWith))
        next.push(replaceWith);
    saveCityList(next);
    if (getCurrentCity() === '我的位置' && replaceWith) {
        setCurrentCity(replaceWith);
    }
}
// 缓存天气数据
function cacheWeatherData(city, data) {
    try {
        const key = `weather_${city}_${Date.now()}`;
        wx.setStorageSync(key, JSON.stringify(data));
    }
    catch (error) {
        console.error('缓存天气数据失败:', error);
    }
}
// 获取缓存的天气数据
function getCachedWeatherData(city) {
    try {
        // 这里简化处理，实际应该检查缓存有效期
        const keys = wx.getStorageInfoSync().keys;
        const weatherKey = keys.find(key => key.startsWith(`weather_${city}_`));
        if (weatherKey) {
            const data = wx.getStorageSync(weatherKey);
            return JSON.parse(data);
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
