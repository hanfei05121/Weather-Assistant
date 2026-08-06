// pages/weather/particles.ts
// 苹果 iOS 天气风格粒子特效：根据天气代码渲染雨/雪/星星/阳光/雾/沙尘/雷暴等

export type ParticleKind = 'none' | 'sun' | 'star' | 'rain' | 'snow' | 'storm' | 'fog' | 'dust' | 'hail'

interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  speed: number
  alpha: number
}

const TWO_PI = Math.PI * 2

function mapCode(code: string): ParticleKind {
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

const COUNTS: Record<ParticleKind, number> = {
  none: 0,
  sun: 14,
  star: 130,
  rain: 110,
  snow: 110,
  storm: 140,
  fog: 10,
  dust: 90,
  hail: 50
}

export class WeatherParticles {
  private canvas: any = null
  private ctx: any = null
  private width = 0
  private height = 0
  private kind: ParticleKind = 'none'
  private particles: Particle[] = []
  private running = false
  private rafId = 0
  private lastTs = 0
  private flashUntil = 0
  private nextFlash = 0

  init(canvas: any, width: number, height: number, dpr: number) {
    this.canvas = canvas
    this.width = width
    this.height = height
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    this.ctx = canvas.getContext('2d')
    this.ctx.scale(dpr, dpr)
  }

  setWeather(code: string) {
    const next = mapCode(code)
    if (next === this.kind && this.particles.length > 0) return
    this.kind = next
    this.flashUntil = 0
    this.nextFlash = 0
    this.buildParticles()
  }

  start() {
    if (!this.canvas || this.running) return
    this.running = true
    this.lastTs = 0
    if (this.particles.length === 0) this.buildParticles()
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
    this.canvas = null
    this.ctx = null
  }

  private buildParticles() {
    const list: Particle[] = []
    const count = COUNTS[this.kind]
    for (let i = 0; i < count; i++) {
      list.push(this.spawn())
    }
    this.particles = list
  }

  private spawn(): Particle {
    const k = this.kind
    const w = this.width
    const h = this.height
    const rnd = Math.random
    const base: Particle = { kind: k, x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, size: 2, phase: rnd() * TWO_PI, speed: 1, alpha: 1 }

    switch (k) {
      case 'rain':
        return { ...base, vx: -140 - 160 * rnd(), vy: 620 + 380 * rnd(), size: 9 + 9 * rnd(), alpha: 0.5 + 0.25 * rnd() }
      case 'storm':
        return { ...base, vx: -140 - 160 * rnd(), vy: 650 + 400 * rnd(), size: 10 + 10 * rnd(), alpha: 0.6 + 0.25 * rnd() }
      case 'snow':
        return { ...base, vy: 42 + 55 * rnd(), size: 1.5 + 2.5 * rnd(), speed: 0.6 + 0.8 * rnd(), alpha: 0.7 + 0.3 * rnd() }
      case 'hail':
        return { ...base, vx: 20 + 40 * rnd(), vy: 540 + 360 * rnd(), size: 3 + 4 * rnd(), alpha: 0.85 + 0.15 * rnd() }
      case 'star':
        return { ...base, size: 0.8 + 1.6 * rnd(), speed: 0.8 + 1.6 * rnd() }
      case 'sun':
        return { ...base, vx: -12 + 24 * rnd(), vy: -18 - 20 * rnd(), size: 30 + 45 * rnd(), alpha: 0.05 + 0.05 * rnd() }
      case 'fog':
        return { ...base, vx: 12 + 22 * rnd(), vy: -2 + 4 * rnd(), size: 110 + 120 * rnd(), alpha: 0.045 + 0.035 * rnd() }
      case 'dust':
        return { ...base, vx: 60 + 120 * rnd(), vy: 5 + 25 * rnd(), size: 1 + 2.5 * rnd(), alpha: 0.12 + 0.3 * rnd() }
      default:
        return base
    }
  }

  private tick(ts: number) {
    if (!this.running) return
    if (!this.lastTs) this.lastTs = ts
    const dt = Math.min(ts - this.lastTs, 50) / 1000
    this.lastTs = ts
    this.draw(dt, ts / 1000)
    this.rafId = this.canvas.requestAnimationFrame((t: number) => this.tick(t))
  }

  private draw(dt: number, t: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      this.updateParticle(p, dt, t)
      this.renderParticle(p, t)
    }

    if (this.kind === 'storm') this.renderLightning(t)
  }

  private updateParticle(p: Particle, dt: number, t: number) {
    switch (p.kind) {
      case 'rain':
      case 'storm':
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y > this.height + 30) {
          p.y = -20
          p.x = Math.random() * this.width
        }
        break
      case 'snow':
        p.y += p.vy * dt
        p.x += Math.sin(t * p.speed + p.phase) * 45 * dt
        if (p.y > this.height + 10) {
          p.y = -10
          p.x = Math.random() * this.width
        }
        break
      case 'hail':
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y > this.height + 10) {
          p.y = -10
          p.x = Math.random() * this.width
        }
        break
      case 'sun':
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y < -p.size) {
          p.y = this.height + p.size
          p.x = Math.random() * this.width
        }
        if (p.x < -p.size) p.x = this.width + p.size
        if (p.x > this.width + p.size) p.x = -p.size
        break
      case 'fog':
        p.x += p.vx * dt
        if (p.x > this.width + p.size) {
          p.x = -p.size
          p.y = Math.random() * this.height
        }
        break
      case 'dust':
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.x > this.width + 10) {
          p.x = -10
          p.y = Math.random() * this.height
        }
        if (p.y < -10) p.y = this.height + 10
        if (p.y > this.height + 10) p.y = -10
        break
      default:
        break
    }
  }

  private renderParticle(p: Particle, t: number) {
    const ctx = this.ctx
    switch (p.kind) {
      case 'rain':
        ctx.strokeStyle = `rgba(160,195,255,${p.alpha})`
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.size * 0.35, p.y - p.size)
        ctx.stroke()
        break
      case 'storm':
        ctx.strokeStyle = `rgba(195,218,255,${p.alpha})`
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.size * 0.35, p.y - p.size)
        ctx.stroke()
        break
      case 'snow':
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
        break
      case 'hail':
        ctx.fillStyle = `rgba(235,245,255,${p.alpha})`
        ctx.fillRect(p.x, p.y, p.size, p.size)
        break
      case 'star':
        ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * p.speed + p.phase))})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
        break
      case 'sun': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        g.addColorStop(0, `rgba(255,201,94,${p.alpha})`)
        g.addColorStop(1, 'rgba(255,201,94,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
        break
      }
      case 'fog': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        g.addColorStop(0, `rgba(200,214,238,${p.alpha})`)
        g.addColorStop(1, 'rgba(200,214,238,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
        break
      }
      case 'dust':
        ctx.fillStyle = `rgba(222,190,140,${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
        ctx.fill()
        break
      default:
        break
    }
  }

  private renderLightning(t: number) {
    const now = t * 1000
    if (now > this.nextFlash) {
      this.nextFlash = now + 1800 + Math.random() * 4200
      this.flashUntil = now + 130
    }
    if (now < this.flashUntil) {
      this.ctx.fillStyle = 'rgba(255,255,255,0.22)'
      this.ctx.fillRect(0, 0, this.width, this.height)
    }
  }
}
