// pages/weather/three-particles.ts
// three.js (threejs-miniprogram 适配版) 天气粒子特效
// 苹果天气风格：屏幕平面上的密集雨丝幕（细斜线），其他天气用圆点粒子

import { createScopedThreejs } from 'threejs-miniprogram'

type Kind = 'none' | 'sun' | 'star' | 'rain' | 'snow' | 'storm' | 'fog' | 'dust' | 'hail'

const DOT_PATH = '/images/particles/dot.png'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  speed: number
  alpha: number
}

const RAND = Math.random

function mapCode(code: string): Kind {
  const c = parseInt(code, 10)
  if (c === 100 || c === 101 || c === 102 || c === 103) return 'sun'
  if (c === 104) return 'fog'
  if (c >= 150 && c <= 154) return 'star'
  if (c === 302 || c === 303 || c === 304) return 'storm'
  if (c >= 305 && c <= 318) return 'rain'
  if (c === 399) return 'rain'
  if (c >= 350 && c <= 351) return 'snow'
  if (c >= 400 && c <= 408) return 'snow'
  if (c === 499) return 'snow'
  if (c === 500 || c === 501 || c === 509 || c === 510 || c === 514 || c === 515) return 'fog'
  if (c === 502 || c === 511 || c === 512 || c === 513) return 'fog'
  if (c === 503 || c === 504 || c === 507 || c === 508) return 'dust'
  if (c === 313) return 'hail'
  if (c === 900) return 'sun'
  return 'none'
}

const CFG = {
  sun:    { count: 14,  color: 0xffc95e, opacity: 0.55, size: 60,  line: false },
  star:   { count: 150, color: 0xffffff, opacity: 0.95, size: 2,   line: false },
  rain:   { count: 800, color: 0xaac8ff, opacity: 0.45, size: 1,   line: true },
  snow:   { count: 120, color: 0xffffff, opacity: 0.9,  size: 5,   line: false },
  storm:  { count: 900, color: 0xaac8ff, opacity: 0.5,  size: 1,   line: true },
  fog:    { count: 12,  color: 0xc8d6ee, opacity: 0.4,  size: 160, line: false },
  dust:   { count: 90,  color: 0xdeb887, opacity: 0.5,  size: 3.5, line: false },
  hail:   { count: 60,  color: 0xeef6ff, opacity: 0.95, size: 8,   line: false },
} as const

type FieldKey = keyof typeof CFG

// 星星大小分层（少而亮的大星 + 中星 + 大量小星）
const STAR_TIERS = [
  { size: 7, frac: 0.12 },
  { size: 4.4, frac: 0.30 },
  { size: 2.6, frac: 0.58 },
] as const

// 一个渲染层（对应一个 geometry/material/Points，尺寸统一）
interface Layer {
  positions: Float32Array
  geometry: any
  material: any
  object: any
  count: number
  used: number
}

type FieldItem = Particle & { layer: number, li: number }

class ParticleField {
  kind: Kind
  items: FieldItem[] = []
  layers: Layer[] = []
  isLine = false
  private count: number
  private W: number
  private H: number
  private windSpeed: number

  constructor(THREE: any, kind: Exclude<Kind, 'none'>, W: number, H: number, texture: any, windSpeed = 0) {
    this.kind = kind
    this.W = W
    this.H = H
    this.windSpeed = windSpeed
    const cfg = CFG[kind as FieldKey]
    this.count = cfg.count
    this.isLine = cfg.line

    if (cfg.line) {
      const positions = new Float32Array(this.count * 6)
      const geometry = new THREE.BufferGeometry()
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity })
      const object = new THREE.LineSegments(geometry, material)
      object.frustumCulled = false
      this.layers = [{ positions, geometry, material, object, count: this.count, used: 0 }]
    } else if (kind === 'star') {
      let allocated = 0
      for (let t = 0; t < STAR_TIERS.length; t++) {
        const tier = STAR_TIERS[t]
        const last = t === STAR_TIERS.length - 1
        const cnt = last ? this.count - allocated : Math.max(1, Math.round(this.count * tier.frac))
        allocated += cnt
        const positions = new Float32Array(cnt * 3)
        const geometry = new THREE.BufferGeometry()
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3))
        const material = new THREE.PointsMaterial({
          size: tier.size,
          map: texture,
          color: cfg.color,
          transparent: true,
          opacity: cfg.opacity,
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: false,
        })
        const object = new THREE.Points(geometry, material)
        object.frustumCulled = false
        this.layers.push({ positions, geometry, material, object, count: cnt, used: 0 })
      }
    } else {
      const positions = new Float32Array(this.count * 3)
      const geometry = new THREE.BufferGeometry()
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        size: cfg.size,
        map: texture,
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      })
      const object = new THREE.Points(geometry, material)
      object.frustumCulled = false
      this.layers = [{ positions, geometry, material, object, count: this.count, used: 0 }]
    }

    for (let i = 0; i < this.count; i++) {
      const layerIdx = this.pickLayer()
      const layer = this.layers[layerIdx]
      const p = Object.assign(this.spawn(), { layer: layerIdx, li: layer.used })
      layer.used++
      this.items.push(p)
    }
    this.flush()
  }

  // 非星星恒为第 0 层；星星按层级权重随机分配
  private pickLayer(): number {
    if (this.kind !== 'star') return 0
    const r = Math.random()
    let acc = 0
    for (let t = 0; t < STAR_TIERS.length; t++) {
      acc += STAR_TIERS[t].frac
      if (r <= acc) return t
    }
    return this.layers.length - 1
  }

  // 供 ThreeWeatherParticles 将每个渲染层都加入场景
  get objects(): any[] {
    return this.layers.map(l => l.object)
  }

  private spawn(): Particle {
    const W = this.W
    const H = this.H
    const wind = this.windSpeed
    const base = { x: RAND() * W, y: RAND() * H, vx: 0, vy: 0, size: 0, phase: RAND() * 6.283, speed: 1, alpha: 1 }
    switch (this.kind) {
      case 'rain':
      case 'storm':
        return {
          ...base,
          y: -RAND() * H * 0.3 + RAND() * H * 1.3,
          vx: -30 - 40 * RAND() - wind * 0.15,
          vy: -(120 + 80 * RAND()),
          speed: 1,
          alpha: 0.5 + 0.5 * RAND(),
        }
      case 'snow':
        return { ...base, y: H * (0.6 + RAND() * 0.4), vy: -(15 + 20 * RAND()), speed: 0.6 + 0.8 * RAND(), alpha: 0.7 + 0.3 * RAND() }
      case 'hail':
        return { ...base, y: H * (0.6 + RAND() * 0.4), vx: 10 + 20 * RAND() + wind * 0.2, vy: -(300 + 150 * RAND()), speed: 1, alpha: 0.85 + 0.15 * RAND() }
      case 'star':
        return { ...base, y: RAND() * H, speed: 0.8 + 1.6 * RAND() }
      case 'sun':
        return { ...base, y: RAND() * H * 0.7, vx: -12 + 24 * RAND(), vy: -15 - 15 * RAND(), speed: 0.3 + 0.4 * RAND(), alpha: 0.5 + 0.4 * RAND() }
      case 'fog':
        return { ...base, y: RAND() * H * 0.6, vx: 12 + 22 * RAND(), vy: -2 + 4 * RAND(), speed: 0.2, alpha: 0.6 + 0.4 * RAND() }
      case 'dust':
        return { ...base, y: RAND() * H, vx: 50 + 100 * RAND() + wind * 0.3, vy: -5 - 20 * RAND(), speed: 0.5, alpha: 0.3 + 0.5 * RAND() }
      default:
        return { ...base, size: 0, speed: 1 } as Particle
    }
  }

  update(dt: number, t: number) {
    const W = this.W
    const H = this.H
    const items = this.items
    const isLine = this.isLine
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      switch (this.kind) {
        case 'rain':
        case 'storm':
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.y < -30) { p.y = H + 30; p.x = RAND() * W }
          break
        case 'snow':
          p.y += p.vy * dt
          p.x += Math.sin(t * p.speed + p.phase) * 45 * dt
          if (p.y < -10) { p.y = H + 10; p.x = RAND() * W }
          break
        case 'hail':
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.y < -10) { p.y = H + 10; p.x = RAND() * W }
          break
        case 'sun':
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.y < -60) { p.y = H + 60; p.x = RAND() * W }
          if (p.x < -60) p.x = W + 60
          if (p.x > W + 60) p.x = -60
          break
        case 'fog':
          p.x += p.vx * dt
          if (p.x > W + 160) { p.x = -160; p.y = RAND() * H * 0.6 }
          break
        case 'dust':
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x > W + 10) { p.x = -10; p.y = RAND() * H }
          if (p.y < -10) p.y = H + 10
          if (p.y > H + 10) p.y = -10
          break
        default:
          break
      }
      const layer = this.layers[p.layer]
      if (isLine) {
        const idx = p.li * 6
        const len = 45
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1
        const dx = (p.vx / spd) * len
        const dy = (p.vy / spd) * len
        layer.positions[idx] = p.x; layer.positions[idx + 1] = p.y; layer.positions[idx + 2] = 0
        layer.positions[idx + 3] = p.x + dx; layer.positions[idx + 4] = p.y + dy; layer.positions[idx + 5] = 0
      } else {
        const idx = p.li * 3
        layer.positions[idx] = p.x; layer.positions[idx + 1] = p.y; layer.positions[idx + 2] = 0
      }
      layer.geometry.attributes.position.needsUpdate = true
    }
    if (this.kind === 'star') {
      for (let li = 0; li < this.layers.length; li++) {
        // 各层亮度相位错开，星星闪烁更自然
        this.layers[li].material.opacity = CFG.star.opacity * (0.55 + 0.45 * Math.abs(Math.sin(t * 1.3 + li * 0.8)))
      }
    }
  }

  private flush() {
    const isLine = this.isLine
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]
      const layer = this.layers[p.layer]
      if (isLine) {
        const idx = p.li * 6
        const len = 45
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1
        const dx = (p.vx / spd) * len
        const dy = (p.vy / spd) * len
        layer.positions[idx] = p.x; layer.positions[idx + 1] = p.y; layer.positions[idx + 2] = 0
        layer.positions[idx + 3] = p.x + dx; layer.positions[idx + 4] = p.y + dy; layer.positions[idx + 5] = 0
      } else {
        const idx = p.li * 3
        layer.positions[idx] = p.x; layer.positions[idx + 1] = p.y; layer.positions[idx + 2] = 0
      }
      layer.geometry.attributes.position.needsUpdate = true
    }
  }

  dispose() {
    for (const layer of this.layers) {
      layer.geometry.dispose()
      layer.material.dispose()
    }
  }
}

export class ThreeWeatherParticles {
  private canvas: any = null
  private THREE: any = null
  private renderer: any = null
  private scene: any = null
  private camera: any = null
  private texture: any = null
  private flashMat: any = null
  private fields: ParticleField[] = []
  private W = 0
  private H = 0
  private kind: Kind = 'none'
  private running = false
  private rafId = 0
  private lastTs = 0
  private flashUntil = 0
  private nextFlash = 0

  init(canvas: any, width: number, height: number, dpr: number) {
    this.canvas = canvas
    this.W = width
    this.H = height
    const THREE = createScopedThreejs(canvas)
    this.THREE = THREE
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    this.renderer.setPixelRatio(Math.min(dpr, 2))
    this.renderer.setSize(width, height)
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(0, width, height, 0, -100, 100)
    this.camera.position.z = 10
    this.texture = new THREE.TextureLoader().load(DOT_PATH)
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })
    const flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.flashMat)
    flashMesh.position.set(width / 2, height / 2, 20)
    this.scene.add(flashMesh)
  }

  setWeather(code: string, windSpeed = 0) {
    const next = mapCode(code)
    if (next === this.kind && this.fields.length > 0) return
    this.kind = next
    this.clearFields()
    this.flashUntil = 0
    this.nextFlash = 0
    if (next !== 'none') {
      const THREE = this.THREE
      const field = new ParticleField(THREE, next as Exclude<Kind, 'none'>, this.W, this.H, this.texture, windSpeed)
      this.fields.push(field)
      for (const obj of field.objects) this.scene.add(obj)
    }
  }

  start() {
    if (!this.canvas || this.running) return
    this.running = true
    this.lastTs = 0
    this.rafId = this.canvas.requestAnimationFrame((ts: number) => this.tick(ts))
  }

  stop() {
    this.running = false
    if (this.canvas && this.rafId) {
      this.canvas.cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  destroy() {
    this.stop()
    this.clearFields()
    if (this.renderer) this.renderer.dispose()
    this.canvas = null
    this.renderer = null
    this.scene = null
  }

  private clearFields() {
    for (let i = 0; i < this.fields.length; i++) {
      for (const obj of this.fields[i].objects) this.scene.remove(obj)
      this.fields[i].dispose()
    }
    this.fields = []
  }

  private tick(ts: number) {
    if (!this.running) return
    if (!this.lastTs) this.lastTs = ts
    const dt = Math.min(ts - this.lastTs, 50) / 1000
    this.lastTs = ts
    const t = ts / 1000
    for (let i = 0; i < this.fields.length; i++) {
      this.fields[i].update(dt, t)
    }
    this.updateLightning(t)
    this.renderer.render(this.scene, this.camera)
    this.rafId = this.canvas.requestAnimationFrame((x: number) => this.tick(x))
  }

  private updateLightning(t: number) {
    if (this.kind !== 'storm' || !this.flashMat) return
    const now = t * 1000
    if (now > this.nextFlash) {
      this.nextFlash = now + 1800 + RAND() * 4200
      this.flashUntil = now + 130
    }
    this.flashMat.opacity = now < this.flashUntil ? 0.22 : 0
  }
}
