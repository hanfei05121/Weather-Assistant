"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pages/typhoon/typhoon.ts
const api_1 = require("../../utils/api");
// 台风类型中文映射
const TYPHOON_TYPE = {
    TD: '热带低压',
    TS: '热带风暴',
    STS: '强热带风暴',
    TY: '台风',
    STY: '强台风',
    SuperTY: '超强台风'
};
// 移动方位映射
const DIR_TEXT = {
    N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北'
};
// 节点间隔 2 小时
const NODE_INTERVAL_MS = 2 * 60 * 60 * 1000;
// 风力等级（蒲福风级）：风速 m/s → 等级
function windSpeedToLevel(speed) {
    if (speed < 0.3)
        return 0;
    if (speed < 1.6)
        return 1;
    if (speed < 3.4)
        return 2;
    if (speed < 5.5)
        return 3;
    if (speed < 8.0)
        return 4;
    if (speed < 10.8)
        return 5;
    if (speed < 13.9)
        return 6;
    if (speed < 17.2)
        return 7;
    if (speed < 20.8)
        return 8;
    if (speed < 24.5)
        return 9;
    if (speed < 28.5)
        return 10;
    if (speed < 32.7)
        return 11;
    if (speed < 36.9)
        return 12;
    if (speed < 41.5)
        return 13;
    if (speed < 46.2)
        return 14;
    if (speed < 51.0)
        return 15;
    if (speed < 56.1)
        return 16;
    return 17;
}
Page({
    data: {
        currentYear: 0,
        year: 0,
        stormList: [],
        currentStorm: null,
        loading: true,
        error: '',
        // 当前台风信息
        currentInfo: null,
        // 时间轴
        timeline: [],
        timelineIndex: 0,
        // 地图
        latitude: 20,
        longitude: 120,
        mapSetting: {
            darkMode: true,
            mapStyle: 1
        },
        markers: [],
        polylines: [],
        circles: [],
        polygons: [],
        // 详情弹窗
        showDetail: false,
        detailPoint: null,
        detailX: 0,
        detailY: 0
    },
    // 路径数据
    allHistory: [],
    allForecast: [],
    histNodes: [],
    fcNodes: [],
    progressIndex: 0,
    // 地图尺寸（用于弹窗定位）
    mapWidth: 0,
    mapHeight: 0,
    mapLeft: 0,
    mapTop: 0,
    // 涡旋动画
    vortexAngle: 0,
    vortexTimer: 0,
    onLoad() {
        const year = new Date().getFullYear();
        this.setData({ currentYear: year, year });
        this.loadStorms(year);
    },
    onReady() {
        this.initMapView();
    },
    onUnload() {
        if (this.vortexTimer) {
            clearInterval(this.vortexTimer);
            this.vortexTimer = 0;
        }
    },
    initMapView() {
        wx.createSelectorQuery().in(this).select('#typhoon-map').boundingClientRect((rect) => {
            if (rect) {
                this.mapWidth = rect.width;
                this.mapHeight = rect.height;
                this.mapLeft = rect.left;
                this.mapTop = rect.top;
            }
        }).exec();
        if (!this.vortexTimer) {
            this.startVortexAnimation();
        }
    },
    // 将公里 + 方位角转换为经纬度偏移
    offsetFromCenter(lat, lon, rKm, bearing) {
        const dLat = rKm * Math.cos(bearing) / 111.32;
        const dLon = rKm * Math.sin(bearing) / (111.32 * Math.cos(lat * Math.PI / 180));
        return { latitude: lat + dLat, longitude: lon + dLon };
    },
    // Catmull-Rom 样条：单段插值点
    catmullPoint(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const lat = 0.5 * (2 * p1.latitude + (-p0.latitude + p2.latitude) * t +
            (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
            (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3);
        const lon = 0.5 * (2 * p1.longitude + (-p0.longitude + p2.longitude) * t +
            (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
            (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3);
        return { latitude: lat, longitude: lon };
    },
    // 将路径折线平滑为曲滑线（每段细分 subdiv 个点）
    smoothPath(points, subdiv = 12) {
        const n = points.length;
        if (n < 3)
            return points;
        const out = [];
        for (let i = 0; i < n - 1; i++) {
            const p0 = points[i - 1] || points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;
            for (let j = 0; j <= subdiv; j++) {
                out.push(this.catmullPoint(p0, p1, p2, p3, j / subdiv));
            }
        }
        return out;
    },
    // 生成龙卷风式螺旋臂多边形（原生覆盖物，随地图移动缩放）
    buildVortexPolygons(lat, lon, radiusKm, angle) {
        const arms = 6;
        const turns = 1.8;
        const band = 0.35;
        const segments = 40;
        const innerFrac = 0.05;
        const polys = [];
        for (let a = 0; a < arms; a++) {
            const base = angle + (a / arms) * Math.PI * 2;
            const pts = [];
            // 外缘到中心
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const th = base + t * turns * Math.PI * 2;
                const rr = radiusKm * (1 - (1 - innerFrac) * t);
                pts.push(this.offsetFromCenter(lat, lon, rr, th));
            }
            // 中心返回外缘（错开 band 角形成带状）
            for (let i = segments; i >= 0; i--) {
                const t = i / segments;
                const th = base + band + t * turns * Math.PI * 2;
                const rr = radiusKm * (1 - (1 - innerFrac) * t);
                pts.push(this.offsetFromCenter(lat, lon, rr, th));
            }
            polys.push({
                points: pts,
                fillColor: 'rgba(100, 200, 255, 0.35)',
                strokeColor: 'rgba(140, 215, 255, 0.6)',
                strokeWidth: 1,
                zIndex: 6
            });
        }
        return polys;
    },
    // 涡旋旋转动画（低频更新，避免高频 setData 导致地图重绘闪烁）
    startVortexAnimation() {
        this.vortexTimer = setInterval(() => {
            const cur = this.currentPoint();
            if (!cur)
                return;
            const radiusKm = cur.radius30 > 0 ? cur.radius30 : 300;
            this.vortexAngle += 0.5;
            const polys = this.buildVortexPolygons(cur.lat, cur.lon, radiusKm, this.vortexAngle);
            this.setData({ polygons: polys });
        }, 100);
    },
    // 当前显示的那一个点（进度到第几个预报点 / 或最后一个历史点）
    currentPoint() {
        if (!this.allHistory.length && !this.allForecast.length)
            return null;
        if (this.allForecast.length) {
            const i = Math.max(0, Math.min(this.progressIndex, this.allForecast.length - 1));
            return this.allForecast[i];
        }
        return this.allHistory[this.allHistory.length - 1];
    },
    async loadStorms(year) {
        this.setData({ loading: true, error: '' });
        try {
            const res = await (0, api_1.getTyphoonList)(year);
            const storms = (res.storm || []).map((s) => ({
                id: s.id,
                name: s.name,
                isActive: s.isActive === '1'
            }));
            storms.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
            this.setData({ stormList: storms, loading: false });
            if (storms.length) {
                this.selectStorm(storms[0]);
            }
            else {
                this.setData({ error: '该年度暂无台风数据' });
            }
        }
        catch (error) {
            console.error('加载台风列表失败:', error);
            this.setData({ loading: false, error: '加载台风数据失败，请稍后重试' });
        }
    },
    onSelectStorm(e) {
        const id = e.currentTarget.dataset.id;
        const storm = this.data.stormList.find((s) => s.id === id);
        if (storm)
            this.selectStorm(storm);
    },
    onYearChange(e) {
        const year = Number(e.currentTarget.dataset.year);
        if (year === this.data.year)
            return;
        this.setData({ year });
        this.loadStorms(year);
    },
    // 采样节点：每 5 小时一个
    sampleNodes(points) {
        const nodes = [];
        let lastTs = -Infinity;
        for (const p of points) {
            if (p.ts - lastTs >= NODE_INTERVAL_MS) {
                nodes.push({ point: p, ts: p.ts });
                lastTs = p.ts;
            }
        }
        return nodes;
    },
    async selectStorm(storm) {
        this.setData({ loading: true, error: '', currentStorm: storm, timelineIndex: 0, showDetail: false });
        try {
            const [trackRes, forecastRes] = await Promise.all([
                (0, api_1.getTyphoonTrack)(storm.id),
                (0, api_1.getTyphoonForecast)(storm.id).catch(() => null)
            ]);
            const track = trackRes.track || [];
            const now = trackRes.now || null;
            const forecast = this.filterForecast7d(forecastRes && forecastRes.forecast);
            const r30 = (p) => {
                if (!p.windRadius30)
                    return 0;
                const wr = p.windRadius30;
                const vals = [Number(wr.neRadius || 0), Number(wr.seRadius || 0), Number(wr.swRadius || 0), Number(wr.nwRadius || 0)].filter(v => v > 0);
                if (!vals.length)
                    return 0;
                // 取四象限平均值，避免单个异常大值导致范围过大
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                return Math.round(avg);
            };
            const toPoint = (p, isForecast) => ({
                ts: new Date(isForecast ? p.fxTime : p.time).getTime(),
                time: isForecast ? p.fxTime : p.time,
                lat: Number(p.lat),
                lon: Number(p.lon),
                typeText: TYPHOON_TYPE[p.type] || p.type,
                windScale: windSpeedToLevel(Number(p.windSpeed)),
                pressure: Number(p.pressure),
                windSpeed: Number(p.windSpeed),
                moveSpeed: Number(p.moveSpeed) || 0,
                moveDir: DIR_TEXT[p.moveDir] || p.moveDir || '--',
                radius30: r30(p),
                isForecast
            });
            const allHistory = track.map((p) => toPoint(p, false));
            const allForecast = forecast.map((p) => toPoint(p, true));
            // 将当前实况点（trackRes.now）作为预报起点，路径从现在开始而非跳到明天
            if (now) {
                allForecast.unshift({
                    ts: new Date(now.pubTime).getTime(),
                    time: now.pubTime,
                    lat: Number(now.lat),
                    lon: Number(now.lon),
                    typeText: TYPHOON_TYPE[now.type] || now.type,
                    windScale: windSpeedToLevel(Number(now.windSpeed)),
                    pressure: Number(now.pressure),
                    windSpeed: Number(now.windSpeed),
                    moveSpeed: Number(now.moveSpeed) || 0,
                    moveDir: DIR_TEXT[now.moveDir] || now.moveDir || '--',
                    radius30: r30(now),
                    isForecast: false
                });
            }
            const currentInfo = now ? {
                time: now.pubTime,
                lat: Number(now.lat),
                lon: Number(now.lon),
                typeText: TYPHOON_TYPE[now.type] || now.type,
                windScale: windSpeedToLevel(Number(now.windSpeed)),
                pressure: Number(now.pressure),
                windSpeed: Number(now.windSpeed),
                moveSpeed: Number(now.moveSpeed) || 0,
                moveDir: DIR_TEXT[now.moveDir] || now.moveDir || '--'
            } : null;
            this.allHistory = allHistory;
            this.allForecast = allForecast;
            // 历史路径采样节点 + 预报路径采样节点（带各自下标）
            this.histNodes = this.sampleNodes(allHistory);
            this.fcNodes = allForecast.map((p, idx) => ({ point: p, ts: p.ts, idx }));
            // 进度从"现在"开始（第 0 个预报点），历史路径始终完整显示
            this.progressIndex = 0;
            this.applyProgress();
            // 打印风圈半径数据用于调试
            console.log('[台风] 历史路径点:', allHistory.map((p) => ({ time: p.time, radius30: p.radius30 })));
            console.log('[台风] 预报路径点:', allForecast.map((p) => ({ time: p.time, radius30: p.radius30 })));
            this.setData({
                currentInfo,
                timeline: allForecast,
                timelineIndex: 0,
                loading: false
            }, () => {
                // 等 wx:else 分支渲染完成后初始化地图视图
                this.initMapView();
            });
        }
        catch (error) {
            console.error('加载台风路径失败:', error);
            this.setData({ loading: false, error: '加载台风路径失败，请稍后重试' });
        }
    },
    // 按当前进度刷新地图：历史路径始终完整显示，未来 7 天预报随进度逐步展开
    applyProgress() {
        const all = this.allHistory;
        const fc = this.allForecast;
        if (all.length + fc.length === 0)
            return;
        // 预报进度下标（0 = 从现在开始，到最后 = 完整 7 天预报）
        const fcIndex = Math.max(0, Math.min(this.progressIndex, fc.length - 1));
        // 路径线（历史实线始终全显 + 预报蓝线到当前进度），均平滑为曲滑线
        const polylines = [];
        if (all.length) {
            polylines.push({
                points: this.smoothPath(all.map(p => ({ latitude: p.lat, longitude: p.lon }))),
                color: '#FFD24A',
                width: 4,
                arrowLine: true
            });
        }
        if (fc.length) {
            const shown = fc.slice(0, fcIndex + 1).map(p => ({ latitude: p.lat, longitude: p.lon }));
            const pts = all.length ? [{ latitude: all[all.length - 1].lat, longitude: all[all.length - 1].lon }, ...shown] : shown;
            polylines.push({
                points: this.smoothPath(pts),
                color: '#4facfe',
                width: 4
            });
        }
        // 节点 markers（到当前进度为止；历史节点每 5 小时一个，预报节点按采样）
        const markers = [];
        for (let i = 0; i < this.histNodes.length; i++) {
            markers.push({
                id: i,
                latitude: this.histNodes[i].point.lat,
                longitude: this.histNodes[i].point.lon,
                iconPath: '/images/typhoon/dot-gold.png',
                width: 24,
                height: 24,
                anchor: { x: 0.5, y: 0.5 }
            });
        }
        for (const n of this.fcNodes) {
            if (n.idx > fcIndex)
                continue;
            markers.push({
                id: 1000 + n.idx,
                latitude: n.point.lat,
                longitude: n.point.lon,
                iconPath: '/images/typhoon/dot-blue.png',
                width: 24,
                height: 24,
                anchor: { x: 0.5, y: 0.5 }
            });
        }
        // 当前进度点（台风图标高亮）
        const cur = this.currentPoint();
        markers.push({
            id: 9999,
            latitude: cur.lat,
            longitude: cur.lon,
            iconPath: '/images/tabbar/typhoon-active.png',
            width: 34,
            height: 34,
            anchor: { x: 0.5, y: 0.5 }
        });
        // 7 级风圈
        const circles = [];
        if (cur.radius30 > 0) {
            circles.push({
                latitude: cur.lat,
                longitude: cur.lon,
                radius: cur.radius30 * 1000,
                color: '#ffd24a22',
                fillColor: '#ffd24a22',
                strokeWidth: 1
            });
        }
        this.setData({
            latitude: cur.lat,
            longitude: cur.lon,
            markers,
            polylines,
            circles
        });
    },
    // 拖动过程中实时更新路径（bindchanging）
    onTimelineChanging(e) {
        const index = Number(e.detail.value);
        if (!this.allForecast[index])
            return;
        this.progressIndex = index;
        this.setData({ timelineIndex: index });
        this.applyProgress();
    },
    onTimelineChange(e) {
        const index = Number(e.detail.value);
        if (!this.allForecast[index])
            return;
        this.progressIndex = index;
        this.setData({ timelineIndex: index });
        this.applyProgress();
    },
    onMapRegionChange() { },
    onMarkerTap(e) {
        const markerId = Number(e.detail.markerId);
        let point = null;
        if (markerId === 9999) {
            point = this.currentPoint();
        }
        else if (markerId >= 1000) {
            const node = this.fcNodes.find((n) => n.idx === markerId - 1000);
            if (node)
                point = node.point;
        }
        else {
            const histNode = this.histNodes[markerId];
            if (histNode)
                point = histNode.point;
        }
        if (!point)
            return;
        // 将点位经纬度转换为屏幕坐标，弹窗显示在台风上方
        const mapCtx = wx.createMapContext('typhoon-map', this);
        mapCtx.getCenterLocation({
            success: (center) => {
                mapCtx.getScale({
                    success: (s) => {
                        const world = 256 * Math.pow(2, s.scale);
                        const px = (lon) => (lon + 180) / 360 * world;
                        const py = (lat) => {
                            const rad = lat * Math.PI / 180;
                            return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * world;
                        };
                        const cx = (this.mapWidth / 2) + px(point.lon) - px(center.longitude);
                        const cy = (this.mapHeight / 2) + py(point.lat) - py(center.latitude);
                        // 弹窗定位：水平居中，垂直在台风上方（避开标记点）
                        const popupX = this.mapLeft + cx;
                        const popupY = this.mapTop + cy - 60;
                        this.setData({ showDetail: true, detailPoint: point, detailX: popupX, detailY: popupY });
                    },
                    fail: () => {
                        this.setData({ showDetail: true, detailPoint: point });
                    }
                });
            },
            fail: () => {
                this.setData({ showDetail: true, detailPoint: point });
            }
        });
    },
    onCloseDetail() {
        this.setData({ showDetail: false });
    },
    noop() { },
    // 预报路径点仅保留"当前时刻"起未来 7 天内（路径从现在的时间点开始）
    filterForecast7d(forecast) {
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        return (forecast || []).filter((p) => {
            const t = new Date(p.fxTime).getTime();
            return !isNaN(t) && t >= now && t - now <= SEVEN_DAYS_MS;
        });
    }
});
