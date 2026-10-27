import { useEffect, useRef } from 'react'
import { centsToLkrString, type Cents } from '@goldflow/shared'
import { money } from '../../ui.tsx'

export function figure(cents: Cents) {
  return Number(centsToLkrString(cents)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function motionOff() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'off'
}

function scrollParent(node: HTMLElement) {
  let current = node.parentElement
  while (current) {
    const overflow = getComputedStyle(current).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return current
    current = current.parentElement
  }
  return window
}

/** Runs once the node is inside the viewport. Listens to the desk scroller because the embedded view can miss IntersectionObserver. */
export function whenSeen(node: HTMLElement, run: () => void) {
  let done = false
  let frame = 0
  const watcher = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    fire()
  })
  const parent = scrollParent(node)
  const stop = () => {
    cancelAnimationFrame(frame)
    watcher.disconnect()
    parent.removeEventListener('scroll', fire)
    window.removeEventListener('resize', fire)
  }
  const fire = () => {
    if (done) return
    const box = node.getBoundingClientRect()
    const visible = box.height > 0 && box.top < window.innerHeight && box.bottom > 0
    if (!visible && !watcher.takeRecords().some((entry) => entry.isIntersecting)) return
    done = true
    stop()
    run()
  }
  watcher.observe(node)
  parent.addEventListener('scroll', fire, { passive: true })
  window.addEventListener('resize', fire)
  frame = requestAnimationFrame(fire)
  return stop
}

/** Paints the final figure immediately when motion is reduced. Otherwise eases once the node is on screen. */
export function CountUp({ to, kind }: { to: number; kind: 'lkr' | 'grams' | 'rate' | 'count' }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const paint = (value: number) => {
      node.textContent = kind === 'lkr'
        ? money(Math.round(value))
        : kind === 'grams'
          ? `${value.toFixed(1)} g`
          : kind === 'count'
            ? String(Math.round(value))
            : figure(Math.round(value) as Cents)
    }
    if (motionOff()) {
      paint(to)
      return
    }
    let frame = 0
    let start = 0
    let begun = false
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / 900)
      const eased = 1 - (1 - t) ** 3
      paint(to * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    const stop = whenSeen(node, () => {
      if (begun) return
      begun = true
      frame = requestAnimationFrame(tick)
    })
    return () => {
      stop()
      cancelAnimationFrame(frame)
    }
  }, [to, kind])
  const idle = kind === 'grams' ? '0.0 g' : kind === 'lkr' ? money(0) : kind === 'count' ? '0' : figure(0 as Cents)
  return <span ref={ref}>{idle}</span>
}
