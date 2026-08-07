// pages/typhoon/typhoon.ts
import { getTyphoonList, getTyphoonTrack, getTyphoonForecast } from '../../utils/api'

// 台风类型中文映射
const TYPHOON_TYPE: Record<string, string> = {
  TD: '热带低压',
  TS: '热带风暴',
  STS: '强热带风暴',
  TY: '台风',
  STY: '强台风',
  SuperTY: '超强台风'
}

// 移动方位映射
const DIR_TEXT: Record<string, string> = {
  N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北'
}

// 节点间隔 5 小时
const NODE_INTERVAL_MS = 5 * 60 * 60 * 1000

interface StormItem {
  id: string
  name: string
  isActive: boolean
}

interface PathPoint {
  ts: number
  time: string
  lat: number
  lon: number
  typeText: string
  pressure: number
  windSpeed: number
  moveSpeed: number
  moveDir: string
  radius30: number
  isForecast: boolean
}

Page({
  data: {
    currentYear: 0,
    year: 0,
    stormList: [] as StormItem[],
    currentStorm: null as StormItem | null,
    loading: true,
    error: '',
    // 当前台风信息
    currentInfo: null as any,
    // 时间轴
    timeline: [] as PathPoint[],
    timelineIndex: 0,
    // 地图
    latitude: 20,
    longitude: 120,
    mapSetting: {
      darkMode: true,
      mapStyle: 1
    },
    markers: [] as any[],
    polylines: [] as any[],
    circles: [] as any[],
    polygons: [] as any[],
    // 详情弹窗
    showDetail: false,
    detailPoint: null as any,
    detailX: 0,
    detailY: 0
  },

  // 路径数据
  allPoints: [] as PathPoint[],
  nodes: [] as any[],
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
    const year = new Date().getFullYear()
    this.setData({ currentYear: year, year })
    this.loadStorms(year)
  },

  onReady() {
    this.initMapView()
  },

  onUnload() {
    if (this.vortexTimer) {
      clearInterval(this.vortexTimer)
      this.vortexTimer = 0
    }
  },

  initMapView() {
    wx.createSelectorQuery().in(this).select('#typhoon-map').boundingClientRect((rect: any) => {
      if (rect) {
        this.mapWidth = rect.width
        this.mapHeight = rect.height
        this.mapLeft = rect.left
        this.mapTop = rect.top
      }
    }).exec()
    if (!this.vortexTimer) {
      this.startVortexAnimation()
    }
  },

  // 将公里 + 方位角转换为经纬度偏移
  offsetFromCenter(lat: number, lon: number, rKm: number, bearing: number) {
    const dLat = rKm * Math.cos(bearing) / 111.32
    const dLon = rKm * Math.sin(bearing) / (111.32 * Math.cos(lat * Math.PI / 180))
    return { latitude: lat + dLat, longitude: lon + dLon }
  },

  // 生成龙卷风式螺旋臂多边形（原生覆盖物，随地图移动缩放）
  buildVortexPolygons(lat: number, lon: number, radiusKm: number, angle: number) {
    const arms = 6
    const turns = 1.8
    const band = 0.35
    const segments = 14
    const innerFrac = 0.05
    const polys: any[] = []
    for (let a = 0; a < arms; a++) {
      const base = angle + (a / arms) * Math.PI * 2
      const pts: any[] = []
      // 外缘到中心
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const th = base + t * turns * Math.PI * 2
        const rr = radiusKm * (1 - (1 - innerFrac) * t)
        pts.push(this.offsetFromCenter(lat, lon, rr, th))
      }
      // 中心返回外缘（错开 band 角形成带状）
      for (let i = segments; i >= 0; i--) {
        const t = i / segments
        const th = base + band + t * turns * Math.PI * 2
        const rr = radiusKm * (1 - (1 - innerFrac) * t)
        pts.push(this.offsetFromCenter(lat, lon, rr, th))
      }
      polys.push({
        points: pts,
        fillColor: 'rgba(100, 200, 255, 0.35)',
        strokeColor: 'rgba(140, 215, 255, 0.6)',
        strokeWidth: 1,
        zIndex: 6
      })
    }
    return polys
  },

  // 涡旋旋转动画（低频更新，避免高频 setData 导致地图重绘闪烁）
  startVortexAnimation() {
    this.vortexTimer = setInterval(() => {
      if (!this.allPoints.length) return
      const cur = this.allPoints[Math.max(0, this.progressIndex)]
      const radiusKm = cur.radius30 > 0 ? cur.radius30 : 300
      this.vortexAngle += 0.15
      const polys = this.buildVortexPolygons(cur.lat, cur.lon, radiusKm, this.vortexAngle)
      this.setData({ polygons: polys })
    }, 150)
  },

  async loadStorms(year: number) {
    this.setData({ loading: true, error: '' })
    try {
      const res = await getTyphoonList(year)
      const storms: StormItem[] = (res.storm || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive === '1'
      }))
      storms.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
      this.setData({ stormList: storms, loading: false })
      if (storms.length) {
        this.selectStorm(storms[0])
      } else {
        this.setData({ error: '该年度暂无台风数据' })
      }
    } catch (error) {
      console.error('加载台风列表失败:', error)
      this.setData({ loading: false, error: '加载台风数据失败，请稍后重试' })
    }
  },

  onSelectStorm(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    const storm = this.data.stormList.find((s: StormItem) => s.id === id)
    if (storm) this.selectStorm(storm)
  },

  onYearChange(e: WechatMiniprogram.TouchEvent) {
    const year = Number(e.currentTarget.dataset.year)
    if (year === this.data.year) return
    this.setData({ year })
    this.loadStorms(year)
  },

  // 采样节点：每 5 小时一个
  sampleNodes(points: PathPoint[]) {
    const nodes: any[] = []
    let lastTs = -Infinity
    for (const p of points) {
      if (p.ts - lastTs >= NODE_INTERVAL_MS) {
        nodes.push({ point: p, ts: p.ts })
        lastTs = p.ts
      }
    }
    return nodes
  },

  async selectStorm(storm: StormItem) {
    this.setData({ loading: true, error: '', currentStorm: storm, timelineIndex: 0, showDetail: false })
    try {
      const [trackRes, forecastRes] = await Promise.all([
        getTyphoonTrack(storm.id),
        getTyphoonForecast(storm.id).catch(() => null)
      ])
      const track = trackRes.track || []
      const now = trackRes.now || null
      const forecast = this.filterForecast7d(forecastRes && forecastRes.forecast)

      const r30 = (p: any) => {
        if (!p.windRadius30) return 0
        const wr = p.windRadius30
        const vals = [Number(wr.neRadius || 0), Number(wr.seRadius || 0), Number(wr.swRadius || 0), Number(wr.nwRadius || 0)].filter(v => v > 0)
        if (!vals.length) return 0
        // 取四象限平均值，避免单个异常大值导致范围过大
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        return Math.round(avg)
      }
      const toPoint = (p: any, isForecast: boolean): PathPoint => ({
        ts: new Date(isForecast ? p.fxTime : p.time).getTime(),
        time: isForecast ? p.fxTime : p.time,
        lat: Number(p.lat),
        lon: Number(p.lon),
        typeText: TYPHOON_TYPE[p.type] || p.type,
        pressure: Number(p.pressure),
        windSpeed: Number(p.windSpeed),
        moveSpeed: Number(p.moveSpeed) || 0,
        moveDir: DIR_TEXT[p.moveDir] || p.moveDir || '--',
        radius30: r30(p),
        isForecast
      })
      const allPoints = track.map((p: any) => toPoint(p, false)).concat(forecast.map((p: any) => toPoint(p, true)))

      const currentInfo = now ? {
        time: now.pubTime,
        lat: Number(now.lat),
        lon: Number(now.lon),
        typeText: TYPHOON_TYPE[now.type] || now.type,
        pressure: Number(now.pressure),
        windSpeed: Number(now.windSpeed)
      } : null

      this.allPoints = allPoints
      this.nodes = this.sampleNodes(allPoints)
      this.progressIndex = Math.max(0, allPoints.length - 1)
      this.applyProgress()
      // 打印风圈半径数据用于调试
      console.log('[台风] 风圈半径数据:', allPoints.map((p: PathPoint) => ({ time: p.time, radius30: p.radius30, lat: p.lat, lon: p.lon })))

      this.setData({
        currentInfo,
        timeline: allPoints,
        timelineIndex: Math.max(0, allPoints.length - 1),
        loading: false
      }, () => {
        // 等 wx:else 分支渲染完成后初始化地图视图
        this.initMapView()
      })
    } catch (error) {
      console.error('加载台风路径失败:', error)
      this.setData({ loading: false, error: '加载台风路径失败，请稍后重试' })
    }
  },

  // 按当前进度刷新地图：路径线、节点、风圈、中心
  applyProgress() {
    const index = Math.max(0, Math.min(this.progressIndex, this.allPoints.length - 1))
    const all = this.allPoints
    const untilTs = all[index].ts

    // 路径线（历史实线 + 预报蓝线，到当前进度）
    const hist = all.filter(p => !p.isForecast && p.ts <= untilTs)
    const fc = all.filter(p => p.isForecast && p.ts <= untilTs)
    const polylines: any[] = []
    if (hist.length) {
      polylines.push({
        points: hist.map(p => ({ latitude: p.lat, longitude: p.lon })),
        color: '#FFD24A',
        width: 4,
        arrowLine: true
      })
    }
    if (fc.length) {
      const pts = hist.length ? [hist[hist.length - 1], ...fc] : fc
      polylines.push({
        points: pts.map(p => ({ latitude: p.lat, longitude: p.lon })),
        color: '#4facfe',
        width: 4
      })
    }

    // 节点 markers（已到部分显示，每 5 小时一个）
    const markers: any[] = []
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]
      if (node.ts > untilTs) continue
      markers.push({
        id: i,
        latitude: node.point.lat,
        longitude: node.point.lon,
        iconPath: node.point.isForecast ? '/images/typhoon/dot-blue.png' : '/images/typhoon/dot-gold.png',
        width: 24,
        height: 24,
        anchor: { x: 0.5, y: 0.5 }
      })
    }

    // 当前进度点（台风图标高亮）
    const cur = all[index]
    markers.push({
      id: 9999,
      latitude: cur.lat,
      longitude: cur.lon,
      iconPath: '/images/tabbar/typhoon-active.png',
      width: 34,
      height: 34,
      anchor: { x: 0.5, y: 0.5 }
    })

    // 7 级风圈
    const circles: any[] = []
    if (cur.radius30 > 0) {
      circles.push({
        latitude: cur.lat,
        longitude: cur.lon,
        radius: cur.radius30 * 1000,
        color: '#ffd24a22',
        fillColor: '#ffd24a22',
        strokeWidth: 1
      })
    }

    this.setData({
      latitude: cur.lat,
      longitude: cur.lon,
      markers,
      polylines,
      circles
    })
  },

  // 拖动过程中实时更新路径（bindchanging）
  onTimelineChanging(e: WechatMiniprogram.SliderChange) {
    const index = Number(e.detail.value)
    if (!this.allPoints[index]) return
    this.progressIndex = index
    this.setData({ timelineIndex: index })
    this.applyProgress()
  },

  onTimelineChange(e: WechatMiniprogram.SliderChange) {
    const index = Number(e.detail.value)
    if (!this.allPoints[index]) return
    this.progressIndex = index
    this.setData({ timelineIndex: index })
    this.applyProgress()
  },

  onMapRegionChange() {},

  onMarkerTap(e: WechatMiniprogram.MarkerTap) {
    const markerId = Number(e.detail.markerId)
    let point: PathPoint | null = null
    if (markerId === 9999) {
      point = this.allPoints[this.progressIndex]
    } else {
      const node = this.nodes[markerId]
      if (node) point = node.point
    }
    if (!point) return
    // 将点位经纬度转换为屏幕坐标，弹窗显示在台风上方
    const mapCtx = wx.createMapContext('typhoon-map', this)
    mapCtx.getCenterLocation({
      success: (center) => {
        mapCtx.getScale({
          success: (s) => {
            const world = 256 * Math.pow(2, s.scale)
            const px = (lon: number) => (lon + 180) / 360 * world
            const py = (lat: number) => {
              const rad = lat * Math.PI / 180
              return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * world
            }
            const cx = (this.mapWidth / 2) + px(point!.lon) - px(center.longitude)
            const cy = (this.mapHeight / 2) + py(point!.lat) - py(center.latitude)
            // 弹窗定位：水平居中，垂直在台风上方（避开标记点）
            const popupX = this.mapLeft + cx
            const popupY = this.mapTop + cy - 60
            this.setData({ showDetail: true, detailPoint: point, detailX: popupX, detailY: popupY })
          },
          fail: () => {
            this.setData({ showDetail: true, detailPoint: point })
          }
        })
      },
      fail: () => {
        this.setData({ showDetail: true, detailPoint: point })
      }
    })
  },

  onCloseDetail() {
    this.setData({ showDetail: false })
  },

  noop() {},

  // 预报路径点仅保留未来 7 天内
  filterForecast7d(forecast: any[]): any[] {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    return (forecast || []).filter((p: any) => {
      const t = new Date(p.fxTime).getTime()
      return !isNaN(t) && t - now <= SEVEN_DAYS_MS
    })
  }
})
