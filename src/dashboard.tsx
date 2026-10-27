import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { centsToLkrString, formatDisplayStamp, type Cents } from '@goldflow/shared'
import { moduleOpen } from './access.ts'
import { permits, repairPace, type Shop } from './desk.ts'
import type { LiveBoard } from './liveGold.ts'
import { JewelField } from './ambient.tsx'
import { money } from './ui.tsx'

const purityLabel: Record<string, string> = { '24K': '99.9%', '22K': '91.6%', '18K': '75.0%' }
const purities = ['24K', '22K', '18K'] as const

export function Dashboard({ desk, board }: { desk: Shop; board: LiveBoard | null }) {
  const root = useRef<HTMLDivElement>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const person = desk.accounts.find((account) => account.id === desk.accountId)
  const name = person?.name ?? (desk.role === 'owner' ? 'Admin' : desk.role)
  const completed = desk.invoices.filter((invoice) => invoice.status === 'completed')
  const sales = completed.reduce((sum, invoice) => sum + invoice.totalCents, 0)
  const available = desk.items.filter((item) => item.status === 'available')
  const seeRates = permits(desk, 'editGoldRates') || permits(desk, 'approveGoldRates')
  const seeSales = permits(desk, 'viewPos') || permits(desk, 'viewProfit') || permits(desk, 'viewLimitedProfit')
  const approved = desk.rates.find((rate) => rate.status === 'approved' && rate.rateType === 'shop_selling' && rate.purity === '22K')
  const live = seeRates && board ? board.quotes : null
  const grams = purities.map((purity) => available.filter((item) => item.purity === purity).reduce((sum, item) => sum + Number(item.netGrams), 0))
  const counts = purities.map((purity) => available.filter((item) => item.purity === purity).length)
  const stockGrams = grams.reduce((sum, grams) => sum + grams, 0)
  const notes = attention(desk)

  useEffect(() => {
    const node = root.current
    if (!node) return
    const shown = requestAnimationFrame(() => node.classList.add('go'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'off'
    const fine = window.matchMedia('(hover: hover)').matches && window.matchMedia('(pointer: fine)').matches
    // Tilt, parallax, and the magnetic button stay off for touch and reduced motion.
    if (reduce || !fine) return () => cancelAnimationFrame(shown)

    let raf = 0
    let px = 0
    let py = 0
    const jewel = node.parentElement?.querySelector<HTMLElement>('.jewel-field') ?? null
    const stage = node.querySelector<HTMLElement>('.dash-stage')
    const magnet = node.querySelector<HTMLElement>('.mag span')
    const magnetHost = node.querySelector<HTMLElement>('.mag')

    const apply = () => {
      raf = 0
      const card = node.querySelector<HTMLElement>('.dash-card:hover')
      if (card) {
        const rect = card.getBoundingClientRect()
        const nx = (px - rect.left) / rect.width
        const ny = (py - rect.top) / rect.height
        card.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`)
        card.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`)
        card.style.setProperty('--ry', `${((nx - 0.5) * 12).toFixed(2)}deg`)
        card.style.setProperty('--rx', `${((0.5 - ny) * 12).toFixed(2)}deg`)
      }
      if (jewel) {
        const box = node.getBoundingClientRect()
        jewel.style.setProperty('--jx', ((px - box.left) / box.width - 0.5).toFixed(3))
        jewel.style.setProperty('--jy', ((py - box.top) / box.height - 0.5).toFixed(3))
      }
      if (stage) {
        const rect = stage.getBoundingClientRect()
        const over = px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
        stage.style.setProperty('--hx', over ? ((px - rect.left) / rect.width - 0.5).toFixed(3) : '0')
        stage.style.setProperty('--hy', over ? ((py - rect.top) / rect.height - 0.5).toFixed(3) : '0')
      }
      if (magnet && magnetHost) {
        const rect = magnetHost.getBoundingClientRect()
        const over = px >= rect.left - 24 && px <= rect.right + 24 && py >= rect.top - 24 && py <= rect.bottom + 24
        if (over) {
          const dx = px - (rect.left + rect.width / 2)
          const dy = py - (rect.top + rect.height / 2)
          magnet.style.transform = `translate(${(dx * 0.28).toFixed(1)}px, ${(dy * 0.28).toFixed(1)}px)`
        } else magnet.style.transform = ''
      }
    }
    const onMove = (event: PointerEvent) => {
      px = event.clientX
      py = event.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeaveCard = (event: Event) => {
      const card = event.currentTarget as HTMLElement
      card.style.setProperty('--rx', '0deg')
      card.style.setProperty('--ry', '0deg')
      card.style.setProperty('--mx', '50%')
      card.style.setProperty('--my', '30%')
    }
    const onDown = (event: PointerEvent) => {
      const host = (event.target as HTMLElement | null)?.closest?.('.mag') as HTMLElement | null
      if (!host || !node.contains(host)) return
      const rect = host.getBoundingClientRect()
      const ripple = document.createElement('i')
      ripple.className = 'mag-ripple'
      ripple.style.left = `${event.clientX - rect.left}px`
      ripple.style.top = `${event.clientY - rect.top}px`
      host.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    }
    const cards = [...node.querySelectorAll<HTMLElement>('.dash-card')]
    for (const card of cards) card.addEventListener('pointerleave', onLeaveCard)
    node.addEventListener('pointermove', onMove)
    node.addEventListener('pointerdown', onDown)
    return () => {
      cancelAnimationFrame(shown)
      cancelAnimationFrame(raf)
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerdown', onDown)
      for (const card of cards) card.removeEventListener('pointerleave', onLeaveCard)
    }
  }, [])

  return (
    <div className="relative">
      <JewelField />
      <div ref={root} className="dash relative z-[1]">
        <header className="dash-top">
          <div>
            <p className="dash-eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })}</p>
            <h1>{greeting}, <em>{name}</em></h1>
          </div>
          {moduleOpen(desk, '/pos') ? <Link className="dash-sale mag" to="/pos"><span>New sale</span></Link> : null}
        </header>
        <section className="dash-bento">
          {seeRates ? (
            <article className="dash-card dash-stage dash-reveal" style={{ '--rd': '0ms' } as CSSProperties}>
              <div>
                <h2>Gold rates</h2>
                <p className="dash-lead">Today’s <em>gold</em>, per gram</p>
                <span className={`dash-badge ${live ? 'live' : ''}`}><i />{live ? `Live market · ${formatDisplayStamp(board?.fetchedAt ?? '')}` : 'Snapshot · approved shop rate'}</span>
                <p className="dash-note">{live ? 'The coins use the market board. Hover or tap a coin for the source. The till still sells on the approved shop rate.' : 'This is the rate the till uses. It is not a live quote.'}</p>
              </div>
              <div className="dash-coins">
                {live ? live.map((quote, index) => (
                  <Coin key={quote.purity} purity={quote.purity} cents={quote.cents} figure={figure(quote.cents)} size={index === 1 ? '168px' : '124px'} delay={`${index * -1.4}s`} back={board?.source ?? 'Market board'} />
                )) : approved ? (
                  <Coin purity="22K" cents={approved.cents} figure={figure(approved.cents)} size="180px" delay="-2s" back={approved.source} />
                ) : <p className="dash-note">No approved selling rate. Nothing can be sold at zero.</p>}
              </div>
            </article>
          ) : null}
          {seeSales ? (
            <article className="dash-card dash-sales dash-reveal" style={{ '--rd': '80ms' } as CSSProperties}>
              <div className="dash-row"><h2>Sales</h2></div>
              <p className="dash-big"><CountUp to={sales} kind="lkr" /></p>
              <p className="dash-mute">{completed.length} completed {completed.length === 1 ? 'invoice' : 'invoices'}</p>
              <Spark values={completed.map((invoice) => invoice.totalCents)} />
            </article>
          ) : null}
          <article className="dash-card dash-stock dash-reveal" style={{ '--rd': '160ms' } as CSSProperties}>
            <div className="dash-row"><h2>Gold in stock</h2><span className="dash-mute">Total <b><CountUp to={stockGrams} kind="grams" /></b> · {available.length} pieces</span></div>
            <ul className="dash-vault">
              {purities.map((purity, index) => (
                <li key={purity} className="dash-vault-row">
                  <span className="dash-seal" aria-hidden="true"><GemMark /></span>
                  <span>
                    <b>{purity}</b>
                    <span className="dash-mute">{purityLabel[purity]} · {counts[index]} {counts[index] === 1 ? 'piece' : 'pieces'}</span>
                    <span className="dash-share"><i style={{ '--p': stockGrams ? (grams[index] ?? 0) / stockGrams : 0 } as CSSProperties} /></span>
                  </span>
                  <strong><CountUp to={grams[index] ?? 0} kind="grams" /></strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="dash-card dash-attn dash-reveal" style={{ '--rd': '240ms' } as CSSProperties}>
            <h2>Needs attention</h2>
            {notes.length === 0 ? <p className="dash-mute">Nothing is waiting.</p> : notes.map((note) => (
              <Link key={`${note.to}-${note.title}`} className="dash-pl" style={{ '--c': note.color } as CSSProperties} to={note.to}>
                <i />
                <span><b>{note.title}</b><span className="dash-mute">{note.detail}</span></span>
                <em>Open</em>
              </Link>
            ))}
          </article>
        </section>
      </div>
    </div>
  )
}

function GemMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6 3-6M12 21 9 9M12 21l3-12" />
    </svg>
  )
}

function Coin({ purity, cents, figure, size, delay, back }: { purity: string; cents: number; figure: string; size: string; delay: string; back: string }) {
  const [flip, setFlip] = useState(false)
  return (
    <button type="button" className={`dash-coin ${flip ? 'flip' : ''}`} style={{ '--sz': size, '--dl': delay } as CSSProperties} aria-label={`${purity} ${figure} LKR per gram`} onClick={() => setFlip((open) => !open)}>
      <span className="dash-float">
        <span className="dash-cf">
          <span className="dash-face dash-front">
            <small>{purity} · {purityLabel[purity]}</small>
            <b><CountUp to={cents} kind="rate" /></b>
            <small>LKR / g</small>
          </span>
          <span className="dash-face dash-back">
            <small>{purity}</small>
            <b>{back}</b>
          </span>
        </span>
      </span>
      <i className="dash-shadow" aria-hidden="true" />
    </button>
  )
}

function Spark({ values }: { values: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLParagraphElement>(null)
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = Math.max(max - min, 1)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 300
    const y = 92 - ((value - min) / span) * 70
    return { x, y, value }
  })
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const tip = tipRef.current
    if (!svg || !tip) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 300
    let nearest = points[0]
    for (const point of points) {
      if (nearest && Math.abs(point.x - x) < Math.abs(nearest.x - x)) nearest = point
    }
    if (!nearest) return
    const guide = svg.querySelector('.dash-guide')
    const dot = svg.querySelector('.dash-dot')
    guide?.setAttribute('x1', nearest.x.toFixed(1))
    guide?.setAttribute('x2', nearest.x.toFixed(1))
    dot?.setAttribute('cx', nearest.x.toFixed(1))
    dot?.setAttribute('cy', nearest.y.toFixed(1))
    svg.dataset.hot = 'true'
    tip.textContent = money(nearest.value)
    tip.style.left = `${(nearest.x / 300) * 100}%`
  }
  return (
    <div className="dash-plot" onPointerLeave={() => { if (svgRef.current) delete svgRef.current.dataset.hot }}>
      <svg ref={svgRef} viewBox="0 0 300 110" className="dash-spark" role="img" aria-label="Completed sales" onPointerMove={onMove}>
        <g className="dash-area"><path d={`${line} L300 110 L0 110 Z`} /></g>
        <path className="dash-line" d={line} fill="none" stroke="#8A6A24" strokeWidth="3" strokeLinecap="round" />
        <line className="dash-guide" x1="0" x2="0" y1="8" y2="102" />
        <circle className="dash-dot" r="5" cx="0" cy="0" />
      </svg>
      <p ref={tipRef} className="dash-tip" />
    </div>
  )
}

function CountUp({ to, kind }: { to: number; kind: 'lkr' | 'grams' | 'rate' }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const paint = (value: number) => {
      node.textContent = kind === 'lkr' ? money(Math.round(value)) : kind === 'grams' ? `${value.toFixed(1)} g` : figure(Math.round(value) as Cents)
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'off'
    if (reduce) {
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
    const begin = () => {
      if (begun) return
      begun = true
      frame = requestAnimationFrame(tick)
    }
    const rect = node.getBoundingClientRect()
    const seen = rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      watcher.disconnect()
      begin()
    })
    if (seen) begin()
    else watcher.observe(node)
    return () => {
      cancelAnimationFrame(frame)
      watcher.disconnect()
    }
  }, [to, kind])
  return <span ref={ref}>{kind === 'grams' ? '0.0 g' : kind === 'lkr' ? money(0) : figure(0 as Cents)}</span>
}

function figure(cents: Cents) {
  return Number(centsToLkrString(cents)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function attention(desk: Shop) {
  const notes: { color: string; title: string; detail: string; to: string }[] = []
  if (moduleOpen(desk, '/rates') && desk.rates.some((rate) => rate.status === 'pending_approval')) {
    notes.push({ color: '#E8A33D', title: 'Gold rate waiting for approval', detail: 'A filed quote is not on the till yet', to: '/rates' })
  }
  if (moduleOpen(desk, '/repairs')) {
    for (const job of desk.repairs.filter((entry) => entry.status === 'open')) {
      const pace = repairPace(job)
      notes.push({
        color: pace.tone === 'bad' ? '#E5534B' : '#E8A33D',
        title: `${job.itemLabel} · ${pace.label}`,
        detail: `Received ${job.receivedOn} · deliver ${job.dueOn}`,
        to: '/repairs',
      })
    }
  }
  if (moduleOpen(desk, '/inventory') && desk.adjustments.some((entry) => !entry.approved)) {
    notes.push({ color: '#7C5CD6', title: 'Stock count waiting', detail: 'An adjustment still needs approval', to: '/inventory' })
  }
  if (moduleOpen(desk, '/payments') && desk.invoices.some((invoice) => invoice.status === 'credit')) {
    notes.push({ color: '#C8423B', title: 'Customer balance unpaid', detail: 'A credit bill is still open', to: '/payments' })
  }
  if (moduleOpen(desk, '/purchases') && desk.suppliers.some((supplier) => supplier.balanceCents > 0)) {
    notes.push({ color: '#B7791F', title: 'Supplier balance unpaid', detail: 'A purchase is still owed', to: '/purchases' })
  }
  return notes
}
