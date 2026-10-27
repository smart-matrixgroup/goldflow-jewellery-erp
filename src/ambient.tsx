import { useEffect, useRef } from 'react'

export function useHoverLight() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (document.documentElement.dataset.effects === 'off') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const card = (event.target as HTMLElement | null)?.closest?.('.hover-surface') as HTMLElement | null
      if (!card) return
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
      card.style.setProperty('--my', `${event.clientY - rect.top}px`)
    }
    document.addEventListener('pointermove', onMove)
    return () => document.removeEventListener('pointermove', onMove)
  }, [])
}

export function DeskBackdrop() {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const mark = () => {
      root.dataset.hidden = document.hidden ? 'true' : 'false'
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => {
      document.removeEventListener('visibilitychange', mark)
      delete root.dataset.hidden
    }
  }, [])

  useEffect(() => {
    const node = layer.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      node.dataset.offscreen = entry?.isIntersecting ? 'false' : 'true'
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let stopped = false
    const root = document.documentElement

    const watch = () => {
      cancelAnimationFrame(frame)
      if (stopped || motion.matches || root.dataset.effects === 'off') return
      let frames = 0
      let start = performance.now()
      let coolUntil = 0
      const tick = (now: number) => {
        if (stopped) return
        frame = requestAnimationFrame(tick)
        if (motion.matches || root.dataset.effects === 'off') {
          frames = 0
          start = now
          return
        }
        if (now < coolUntil) return
        frames += 1
        const elapsed = now - start
        if (elapsed >= 2000) {
          const fps = (frames * 1000) / elapsed
          frames = 0
          start = now
          if (fps < 45) {
            root.dataset.ambient = 'off'
            coolUntil = now + 30_000
          } else if (fps > 55) delete root.dataset.ambient
        }
      }
      frame = requestAnimationFrame(tick)
    }

    watch()
    motion.addEventListener('change', watch)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      motion.removeEventListener('change', watch)
      delete root.dataset.ambient
    }
  }, [])

  return (
    <div ref={layer} className="desk-aurora" aria-hidden="true">
      <span className="desk-grid" />
      <span className="desk-orb desk-orb-a" />
      <span className="desk-orb desk-orb-b" />
      <span className="desk-orb desk-orb-c" />
      <span className="desk-orb desk-orb-d" />
      <span className="desk-orb desk-orb-e" />
      <span className="desk-grain" />
      <div className="desk-facet">
        <span className="desk-facet-shift" />
      </div>
    </div>
  )
}

type Gem = { x: number; y: number; r: number; a: number; w: number; d: number; p: number }
type Star = { x: number; y: number; s: number; p: number; v: number; u: number }

export function JewelField() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const node = canvas.current
    const parent = node?.parentElement
    const context = node?.getContext('2d')
    if (!node || !parent || !context) return
    const ctx = context
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(pointer: fine)')
    const rnd = (min: number, max: number) => min + Math.random() * (max - min)
    let width = 0
    let height = 0
    let px = 0
    let py = 0
    let stars: Star[] = []
    let gems: Gem[] = []
    let frame = 0
    let stopped = false
    let running = true
    let slow = 0
    let warmed = false
    let frames = 0
    let accum = 0
    let last = performance.now()

    const star = (x: number, y: number, size: number, alpha: number, ink = '201,162,77') => {
      ctx.fillStyle = `rgba(${ink},${alpha})`
      ctx.beginPath()
      ctx.moveTo(x, y - size)
      ctx.quadraticCurveTo(x, y, x + size, y)
      ctx.quadraticCurveTo(x, y, x, y + size)
      ctx.quadraticCurveTo(x, y, x - size, y)
      ctx.quadraticCurveTo(x, y, x, y - size)
      ctx.fill()
    }

    const gem = (piece: Gem, time: number) => {
      const x = piece.x + px * piece.d * 26
      const y = piece.y + Math.sin(time * 0.0003 + piece.p) * 14 + py * piece.d * 18
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(piece.a + Math.sin(time * 0.00022 + piece.p) * piece.w)
      ctx.scale(piece.r, piece.r)
      ctx.lineWidth = 1.3 / piece.r
      ctx.strokeStyle = 'rgba(176,134,48,.26)'
      ctx.beginPath()
      const points: [number, number][] = [[-0.5, -0.15], [-0.3, -0.5], [0.3, -0.5], [0.5, -0.15], [0, 0.6]]
      points.forEach((point, index) => (index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1])))
      ctx.closePath()
      ctx.moveTo(-0.5, -0.15)
      ctx.lineTo(0.5, -0.15)
      ctx.moveTo(-0.3, -0.5)
      ctx.lineTo(0, -0.15)
      ctx.lineTo(0.3, -0.5)
      ctx.moveTo(0, -0.15)
      ctx.lineTo(0, 0.6)
      ctx.moveTo(-0.5, -0.15)
      ctx.lineTo(0, 0.6)
      ctx.moveTo(0.5, -0.15)
      ctx.lineTo(0, 0.6)
      ctx.stroke()
      ctx.restore()
    }

    const seed = (count: number) => {
      stars = Array.from({ length: count }, () => ({ x: rnd(0, width), y: rnd(0, height), s: rnd(3, 9), p: rnd(0, 6.28), v: rnd(0.6, 1.6), u: rnd(3, 10) }))
      gems = Array.from({ length: 6 }, (_, index) => ({
        x: ((index + 0.5) / 6) * width + rnd(-60, 60),
        y: rnd(0.12, 0.88) * height,
        r: rnd(46, 110),
        a: rnd(-0.4, 0.4),
        w: rnd(0.08, 0.2),
        d: rnd(0.3, 1),
        p: rnd(0, 6.28),
      }))
    }

    const size = () => {
      const box = parent.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = box.width
      height = box.height
      node.width = Math.max(1, width * ratio)
      node.height = Math.max(1, height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (now: number) => {
      if (stopped) return
      const step = now - last
      last = now
      const paused = motion.matches || document.documentElement.dataset.effects === 'off' || document.hidden
      if (running && !paused) {
        accum += step
        frames += 1
        if (frames === 90) {
          const heavy = accum / frames > 34
          frames = 0
          accum = 0
          if (!warmed) warmed = true
          else if (heavy) {
            slow += 1
            if (slow >= 2) {
              running = false
              ctx.clearRect(0, 0, width, height)
              for (const piece of gems) gem(piece, now)
              return
            }
            seed(12)
          } else slow = 0
        }
        ctx.clearRect(0, 0, width, height)
        for (const piece of gems) gem(piece, now)
        for (const flake of stars) {
          flake.y -= (flake.u * step) / 1000
          if (flake.y < -10) {
            flake.y = height + 10
            flake.x = rnd(0, width)
          }
          const alpha = 0.15 + 0.55 * Math.max(0, Math.sin(now * 0.001 * flake.v + flake.p))
          star(flake.x + px * 8, flake.y, flake.s * (0.6 + alpha), alpha)
        }
        const sweep = (((now / 9000) % 1.6) - 0.3) * (width + height)
        const wash = ctx.createLinearGradient(sweep - 160, 0, sweep + 160, height)
        wash.addColorStop(0, 'rgba(255,255,255,0)')
        wash.addColorStop(0.5, 'rgba(255,246,214,.16)')
        wash.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = wash
        ctx.fillRect(0, 0, width, height)
      }
      frame = requestAnimationFrame(draw)
    }

    const onResize = () => {
      size()
      seed(width < 700 ? 20 : 42)
    }
    const onMove = (event: PointerEvent) => {
      const box = parent.getBoundingClientRect()
      px = ((event.clientX - box.left) / Math.max(box.width, 1) - 0.5) * 2
      py = ((event.clientY - box.top) / Math.max(box.height, 1) - 0.5) * 2
    }

    const paintGems = (now: number) => {
      ctx.clearRect(0, 0, width, height)
      for (const piece of gems) gem(piece, now)
    }

    size()
    const quiet = motion.matches || document.documentElement.dataset.effects === 'off'
    seed(quiet ? 0 : width < 700 ? 20 : 42)
    paintGems(0)
    if (!quiet) frame = requestAnimationFrame(draw)
    window.addEventListener('resize', onResize)
    if (!quiet && fine.matches) window.addEventListener('pointermove', onMove)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={canvas} className="jewel-field" aria-hidden="true" />
}
