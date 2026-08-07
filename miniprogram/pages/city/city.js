"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pages/city/city.ts
const storage_1 = require("../../utils/storage");
const api_1 = require("../../utils/api");
let searchTimer = null;
Page({
    data: {
        cities: [],
        currentCity: '',
        searchKeyword: '',
        searchResults: [],
        isSearching: false
    },
    onLoad() {
        this.loadCities();
        this.upgradeLegacyLocation();
    },
    // 自动把旧版裸"我的位置"条目升级为"我的位置（市·区）"
    upgradeLegacyLocation() {
        if (!(0, storage_1.getCityList)().includes('我的位置'))
            return;
        wx.getLocation({
            type: 'gcj02',
            success: (res) => {
                (0, api_1.getCityByLocation)(res.latitude, res.longitude).then((city) => {
                    if (!city)
                        return;
                    const displayName = `我的位置（${city.name}·${city.district}）`;
                    (0, api_1.registerCityId)(displayName, city.id);
                    (0, storage_1.replaceLegacyLocationCity)(displayName);
                    this.loadCities();
                });
            },
            fail: () => { }
        });
    },
    onBack() {
        wx.navigateBack();
    },
    loadCities() {
        const cities = (0, storage_1.getCityList)();
        const currentCity = getCurrentCity();
        this.setData({ cities, currentCity });
    },
    onSearchInput(e) {
        const keyword = e.detail.value;
        this.setData({ searchKeyword: keyword });
        if (searchTimer)
            clearTimeout(searchTimer);
        if (keyword.length > 0) {
            searchTimer = setTimeout(() => this.searchCity(keyword), 300);
        }
        else {
            this.setData({ searchResults: [], isSearching: false });
        }
    },
    async searchCity(keyword) {
        this.setData({ isSearching: true });
        try {
            const result = await (0, api_1.searchCity)(keyword);
            const searchResults = result.location || [];
            this.setData({ searchResults, isSearching: false });
        }
        catch (error) {
            console.error('搜索城市失败:', error);
            this.setData({ isSearching: false });
        }
    },
    onSearchFocus() {
        this.setData({ isSearching: true });
    },
    onSearchBlur() {
        // 仅标记失焦，不隐藏搜索结果，避免用户点击结果时列表消失
        this.setData({ isSearching: false });
    },
    onAddCity(e) {
        const city = e.currentTarget.dataset.city;
        const name = e.currentTarget.dataset.name || city;
        if ((0, storage_1.addCity)(name)) {
            this.loadCities();
            // 清除搜索结果，保持列表状态
            this.setData({ searchKeyword: '', searchResults: [], isSearching: false });
            wx.showToast({
                title: `已添加${name}`,
                icon: 'success'
            });
        }
        else {
            wx.showToast({
                title: '该城市已存在',
                icon: 'none'
            });
        }
    },
    onSelectCity(e) {
        const city = e.currentTarget.dataset.city;
        (0, storage_1.setCurrentCity)(city);
        wx.navigateBack();
    },
    onDeleteCity(e) {
        const city = e.currentTarget.dataset.city;
        wx.showModal({
            title: '确认删除',
            content: `确定要删除${city}吗？`,
            success: (res) => {
                if (res.confirm) {
                    (0, storage_1.removeCity)(city);
                    this.loadCities();
                    wx.showToast({
                        title: `已删除${city}`,
                        icon: 'success'
                    });
                }
            }
        });
    },
    onUseCurrentLocation() {
        wx.getLocation({
            type: 'gcj02',
            success: (res) => {
                (0, api_1.getCityByLocation)(res.latitude, res.longitude).then((city) => {
                    if (!city) {
                        wx.showToast({
                            title: '解析位置失败，请重试',
                            icon: 'none'
                        });
                        return;
                    }
                    const displayName = `我的位置（${city.name}·${city.district}）`;
                    // 注册显示名到真实城市ID的映射，保证天气按真实城市查询
                    (0, api_1.registerCityId)(displayName, city.id);
                    (0, storage_1.replaceLegacyLocationCity)(displayName);
                    (0, storage_1.setCurrentCity)(displayName);
                    this.loadCities();
                    wx.showToast({
                        title: '已添加当前位置',
                        icon: 'success'
                    });
                });
            },
            fail: () => {
                wx.showToast({
                    title: '获取位置失败',
                    icon: 'none'
                });
            }
        });
    }
});
function getCurrentCity() {
    try {
        return wx.getStorageSync('current_city') || '南京';
    }
    catch (error) {
        return '南京';
    }
}
