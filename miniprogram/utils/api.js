"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCityCoords = getCityCoords;
exports.registerCityCoord = registerCityCoord;
exports.getWeatherNow = getWeatherNow;
exports.getWeather10d = getWeather10d;
exports.getWeather24h = getWeather24h;
exports.getWeatherAir = getWeatherAir;
exports.getWeatherIndices = getWeatherIndices;
exports.getWeatherWarning = getWeatherWarning;
exports.getTyphoonList = getTyphoonList;
exports.getTyphoonTrack = getTyphoonTrack;
exports.getTyphoonForecast = getTyphoonForecast;
exports.searchCity = searchCity;
exports.getCityByLocation = getCityByLocation;
exports.registerCityId = registerCityId;
// utils/api.ts
// API Host：每个和风天气账号独有，登录 https://console.qweather.com/setting 查看
// 原公共域名 devapi.qweather.com / geoapi.qweather.com 已从2026年起逐步停止服务，必须使用自己的 API Host
const API_HOST = 'nb6fr9kry3.re.qweatherapi.com';
const API_KEY = '0110bfbfdbbc4d4dbdec758f34d5d29d';
const BASE_URL = `https://${API_HOST}`;
const TIMEOUT = 8000;
// 城市ID本地映射（未命中时通过 GeoAPI 动态查询）
const cityIds = {
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
};
// 已通过 GeoAPI 解析出的城市ID缓存
const locationCache = {};
// 持久化城市名→LocationID 映射（保证"我的位置（市·区）"等自定义名重启后仍能命中真实城市）
const CITY_ID_MAP_KEY = 'city_id_map';
function getPersistedCityId(city) {
    try {
        const map = wx.getStorageSync(CITY_ID_MAP_KEY);
        return (map && map[city]) || null;
    }
    catch (error) {
        return null;
    }
}
function persistCityId(city, id) {
    try {
        const map = wx.getStorageSync(CITY_ID_MAP_KEY) || {};
        map[city] = id;
        wx.setStorageSync(CITY_ID_MAP_KEY, map);
    }
    catch (error) {
        console.error('持久化城市ID失败:', error);
    }
}
// 通用请求方法
async function request(url, params = {}) {
    if (!API_HOST) {
        return Promise.reject(new Error('请先配置 API Host（utils/api.ts 中的 API_HOST 常量）'));
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
            header: {
                'X-QW-Api-Key': API_KEY
            },
            success: (res) => {
                if (res.statusCode === 200) {
                    const data = res.data;
                    if (data && data.code && data.code !== '200') {
                        reject(new Error(`和风天气接口错误: code=${data.code}`));
                    }
                    else {
                        resolve(res.data);
                    }
                }
                else {
                    reject(new Error(`请求失败: ${res.statusCode}`));
                }
            },
            fail: reject
        });
    });
}
// 获取城市 LocationID：优先本地映射，其次持久化映射，再次 GeoAPI 查询并缓存
async function getCityId(city) {
    if (cityIds[city])
        return cityIds[city];
    if (locationCache[city])
        return locationCache[city];
    const persisted = getPersistedCityId(city);
    if (persisted) {
        locationCache[city] = persisted;
        return persisted;
    }
    try {
        const result = await request(`${BASE_URL}/geo/v2/city/lookup`, { location: city, number: '1', range: 'cn' });
        const location = result.location && result.location[0];
        if (location) {
            locationCache[city] = location.id;
            persistCityId(city, location.id);
            return location.id;
        }
    }
    catch (error) {
        console.error('GeoAPI 查询失败:', error);
    }
    return cityIds['南京']; // 兜底默认南京
}
// 城市名→经纬度映射（空气/预警新 v1 接口需要经纬度坐标）
const coordCache = {};
const COORD_MAP_KEY = 'city_coord_map';
function getPersistedCoords(city) {
    try {
        const map = wx.getStorageSync(COORD_MAP_KEY);
        return (map && map[city]) || null;
    }
    catch (error) {
        return null;
    }
}
function persistCoords(city, coord) {
    try {
        const map = wx.getStorageSync(COORD_MAP_KEY) || {};
        map[city] = coord;
        wx.setStorageSync(COORD_MAP_KEY, map);
    }
    catch (error) {
        console.error('持久化城市坐标失败:', error);
    }
}
// 获取城市经纬度：优先本地映射，其次持久化，再次 GeoAPI 反查（仅支持标准城市名）
async function getCityCoords(city) {
    if (coordCache[city])
        return coordCache[city];
    const persisted = getPersistedCoords(city);
    if (persisted) {
        coordCache[city] = persisted;
        return persisted;
    }
    try {
        const result = await request(`${BASE_URL}/geo/v2/city/lookup`, { location: city, number: '1', range: 'cn' });
        const location = result.location && result.location[0];
        if (location && location.lat != null && location.lon != null) {
            const coord = { lat: Number(location.lat), lon: Number(location.lon) };
            coordCache[city] = coord;
            persistCoords(city, coord);
            return coord;
        }
    }
    catch (error) {
        console.error('坐标反查失败:', error);
    }
    return null;
}
// 注册城市名到经纬度的映射（如定位成功后保存 GPS 坐标）
function registerCityCoord(cityName, coord) {
    coordCache[cityName] = coord;
    persistCoords(cityName, coord);
}
// 获取实时天气
async function getWeatherNow(city) {
    const location = await getCityId(city);
    return request(`${BASE_URL}/v7/weather/now`, { location });
}
// 获取10天天气预报
async function getWeather10d(city) {
    const location = await getCityId(city);
    return request(`${BASE_URL}/v7/weather/10d`, { location });
}
// 获取24小时天气预报
async function getWeather24h(city) {
    const location = await getCityId(city);
    return request(`${BASE_URL}/v7/weather/24h`, { location });
}
// 获取空气质量（新版 v1 接口，按经纬度查询）
async function getWeatherAir(city) {
    const coord = await getCityCoords(city);
    if (!coord)
        return null;
    return request(`${BASE_URL}/airquality/v1/current/${coord.lat}/${coord.lon}`);
}
// 获取生活指数（穿衣/紫外线/运动/洗车）
async function getWeatherIndices(city) {
    const location = await getCityId(city);
    return request(`${BASE_URL}/v7/indices/1d`, { location, type: '1,2,3,5' });
}
// 获取极端天气预警（新版 v1 接口，按经纬度查询）
async function getWeatherWarning(city) {
    const coord = await getCityCoords(city);
    if (!coord)
        return null;
    return request(`${BASE_URL}/weatheralert/v1/current/${coord.lat}/${coord.lon}`);
}
// 获取台风列表（basin=NP 西北太平洋，支持本年度和上一年度）
async function getTyphoonList(year) {
    return request(`${BASE_URL}/v7/tropical/storm-list`, { basin: 'NP', year: String(year) });
}
// 获取台风实况和路径
async function getTyphoonTrack(stormId) {
    return request(`${BASE_URL}/v7/tropical/storm-track`, { stormid: stormId });
}
// 获取台风预报路径
async function getTyphoonForecast(stormId) {
    return request(`${BASE_URL}/v7/tropical/storm-forecast`, { stormid: stormId });
}
// 搜索城市（限定中国范围，排除海外同名城市干扰）
async function searchCity(keyword) {
    return request(`${BASE_URL}/geo/v2/city/lookup`, { location: keyword, range: 'cn' });
}
// 通过经纬度反查城市（返回市级 name + 区县级 district + 城市ID）
// 优先取 adm2（地级市），直辖市取 adm1，统一去掉"市"后缀；district 取最近行政区名
async function getCityByLocation(latitude, longitude) {
    try {
        const result = await request(`${BASE_URL}/geo/v2/city/lookup`, {
            location: `${longitude},${latitude}`,
            number: '3',
            range: 'cn'
        });
        const loc = result.location && result.location[0];
        if (!loc)
            return null;
        let cityName = loc.adm2 || loc.name;
        const adm1 = loc.adm1 || '';
        if (!loc.adm2 && (adm1 === '北京市' || adm1 === '上海市' || adm1 === '天津市' || adm1 === '重庆市')) {
            cityName = adm1;
        }
        cityName = cityName.replace(/市$/, '');
        locationCache[cityName] = loc.id;
        persistCityId(cityName, loc.id);
        registerCityCoord(cityName, { lat: Number(loc.lat), lon: Number(loc.lon) });
        return { name: cityName, district: loc.name, id: loc.id };
    }
    catch (error) {
        console.error('定位反查城市失败:', error);
        return null;
    }
}
// 注册城市名到 LocationID 的映射（如"我的位置（南京·玄武区）"→ 南京ID，保证天气查询命中真实城市）
function registerCityId(cityName, id) {
    locationCache[cityName] = id;
    persistCityId(cityName, id);
}
