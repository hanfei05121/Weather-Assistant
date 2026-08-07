"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pages/detail/detail.ts
const api_1 = require("../../utils/api");
Page({
    data: {
        city: '',
        date: '',
        type: '',
        dateTitle: '',
        conditionText: '',
        iconDay: '',
        tempMax: '',
        tempMin: '',
        detailItems: [],
        loading: true,
        error: ''
    },
    onLoad(options) {
        const { city, date, type } = options;
        this.setData({ city: city || '南京', date, type });
        this.loadDetailData();
    },
    async loadDetailData() {
        this.setData({ loading: true, error: '' });
        try {
            const { city, date, type } = this.data;
            if (date) {
                await this.loadDateDetail(city, date);
            }
            else if (type) {
                await this.loadTypeDetail(city, type);
            }
            this.setData({ loading: false });
        }
        catch (error) {
            console.error('加载详情数据失败:', error);
            this.setData({ loading: false, error: '加载详情数据失败，请稍后重试' });
        }
    },
    async loadDateDetail(city, date) {
        const dailyRes = await (0, api_1.getWeather10d)(city);
        const dayData = dailyRes.daily.find((item) => item.fxDate === date);
        if (!dayData)
            return;
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dateObj = new Date(date);
        const weekDay = weekDays[dateObj.getDay()];
        const items = [
            { label: '白天天气', value: dayData.textDay || '--', unit: '' },
            { label: '夜间天气', value: dayData.textNight || '--', unit: '' },
            { label: '最高温度', value: dayData.tempMax || '--', unit: '°C' },
            { label: '最低温度', value: dayData.tempMin || '--', unit: '°C' },
            { label: '降水量', value: dayData.precip || '--', unit: 'mm' },
            { label: '湿度', value: dayData.humidity || '--', unit: '%' },
            { label: '风向', value: dayData.windDirDay || '--', unit: '' },
            { label: '风力', value: dayData.windScaleDay || '--', unit: '级' },
            { label: '风速', value: dayData.windSpeedDay || '--', unit: 'km/h' },
            { label: '紫外线指数', value: dayData.uvIndex || '--', unit: '' },
            { label: '能见度', value: dayData.vis || '--', unit: 'km' },
            { label: '气压', value: dayData.pressure || '--', unit: 'hPa' },
            { label: '日出', value: dayData.sunrise || '--', unit: '' },
            { label: '日落', value: dayData.sunset || '--', unit: '' },
            { label: '月出', value: dayData.moonrise || '--', unit: '' },
            { label: '月落', value: dayData.moonset || '--', unit: '' },
            { label: '月相', value: dayData.moonPhase || '--', unit: '' }
        ];
        this.setData({
            dateTitle: `${date} ${weekDay}`,
            conditionText: dayData.textDay || '',
            iconDay: dayData.iconDay || '',
            tempMax: dayData.tempMax || '',
            tempMin: dayData.tempMin || '',
            detailItems: items
        });
    },
    async loadTypeDetail(city, type) {
        const nowRes = await (0, api_1.getWeatherNow)(city);
        const dailyRes = await (0, api_1.getWeather10d)(city);
        const daily = dailyRes.daily[0];
        const now = nowRes.now;
        const typeConfig = {
            feelslike: {
                title: '体感温度',
                items: [
                    { label: '当前体感', value: now.feelsLike || '--', unit: '°C' },
                    { label: '实际温度', value: now.temp || '--', unit: '°C' },
                    { label: '湿度', value: now.humidity || '--', unit: '%' },
                    { label: '风速', value: now.windSpeed || '--', unit: 'km/h' },
                    { label: '风向', value: now.windDir || '--', unit: '' }
                ]
            },
            humidity: {
                title: '湿度',
                items: [
                    { label: '当前湿度', value: now.humidity || '--', unit: '%' },
                    { label: '温度', value: now.temp || '--', unit: '°C' },
                    { label: '露点温度', value: now.dew || '--', unit: '°C' },
                    { label: '气压', value: now.pressure || '--', unit: 'hPa' }
                ]
            },
            wind: {
                title: '风力风向',
                items: [
                    { label: '风向', value: now.windDir || '--', unit: '' },
                    { label: '风速', value: now.windSpeed || '--', unit: 'km/h' },
                    { label: '风力等级', value: now.windScale || '--', unit: '级' },
                    { label: '阵风', value: now.wind360 || '--', unit: '°' }
                ]
            },
            sun: {
                title: '日出日落',
                items: [
                    { label: '日出', value: daily.sunrise || '--', unit: '' },
                    { label: '日落', value: daily.sunset || '--', unit: '' },
                    { label: '月出', value: daily.moonrise || '--', unit: '' },
                    { label: '月落', value: daily.moonset || '--', unit: '' },
                    { label: '月相', value: daily.moonPhase || '--', unit: '' }
                ]
            },
            visibility: {
                title: '能见度',
                items: [
                    { label: '当前能见度', value: now.vis || '--', unit: 'km' },
                    { label: '气压', value: now.pressure || '--', unit: 'hPa' },
                    { label: '云量', value: now.cloud || '--', unit: '%' }
                ]
            },
            pressure: {
                title: '气压',
                items: [
                    { label: '当前气压', value: now.pressure || '--', unit: 'hPa' },
                    { label: '温度', value: now.temp || '--', unit: '°C' },
                    { label: '湿度', value: now.humidity || '--', unit: '%' },
                    { label: '能见度', value: now.vis || '--', unit: 'km' }
                ]
            },
            uv: {
                title: '紫外线指数',
                items: [
                    { label: 'UV指数', value: daily.uvIndex || '--', unit: '' },
                    { label: '紫外线等级', value: getUvLevel(daily.uvIndex), unit: '' },
                    { label: '日出', value: daily.sunrise || '--', unit: '' },
                    { label: '日落', value: daily.sunset || '--', unit: '' }
                ]
            }
        };
        const config = typeConfig[type] || { title: '天气详情', items: [] };
        this.setData({
            dateTitle: config.title,
            detailItems: config.items
        });
    },
    onBack() {
        wx.navigateBack();
    }
});
function getUvLevel(uv) {
    const n = Number(uv);
    if (isNaN(n) || n < 0)
        return '--';
    if (n <= 2)
        return '低';
    if (n <= 5)
        return '中等';
    if (n <= 7)
        return '高';
    if (n <= 10)
        return '很高';
    return '极高';
}
