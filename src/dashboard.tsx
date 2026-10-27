import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
    const frame = requestAnimationFrame(() => node.classList.add('go'))
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(pointer: fine)')
    if (motion.matches || !fine.matches || document.documentElement.dataset.effects === 'off') {
      return () => cancelAnimationFrame(frame)
    }
    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest?.('.dash-card') as HTMLElement | null
      if (!card || !node.contains(card)) return
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--px', (((event.clientX - rect.left) / rect.width - 0.5) * 2).toFixed(3))
      card.style.setProperty('--py', (((event.clientY - rect.top) / rect.height - 0.5) * 2).toFixed(3))
    }
    const onLeave = (event: Event) => {
      const card = event.currentTarget as HTMLElement
      card.style.setProperty('--px', '0')
      card.style.setProperty('--py', '0')
    }
    const cards = [...node.querySelectorAll<HTMLElement>('.dash-card')]
    for (const card of cards) card.addEventListener('pointerleave', onLeave)
    node.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('pointermove', onMove)
      for (const card of cards) card.removeEventListener('pointerleave', onLeave)
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
          {moduleOpen(desk, '/pos') ? <Link className="dash-sale" to="/pos">New sale</Link> : null}
        </header>
        <section className="dash-bento">
          {seeRates ? (
            <article className="dash-card dash-stage">
              <div>
                <h2>Gold rates</h2>
                <p className="dash-lead dash-dp">Today’s <em>gold</em>, per gram</p>
                <span className={`dash-badge ${live ? 'live' : ''}`}><i />{live ? `Live market · ${formatDisplayStamp(board?.fetchedAt ?? '')}` : 'Snapshot · approved shop rate'}</span>
                <p className="dash-note">{live ? 'The coins use the market board. Hover or tap a coin for the source. The till still sells on the approved shop rate.' : 'This is the rate the till uses. It is not a live quote.'}</p>
              </div>
              <div className="dash-coins">
                {live ? live.map((quote, index) => (
                  <Coin key={quote.purity} purity={quote.purity} figure={figure(quote.cents)} size={index === 1 ? '168px' : '124px'} delay={`${index * -1.4}s`} back={board?.source ?? 'Market board'} />
                )) : approved ? (
                  <Coin purity="22K" figure={figure(approved.cents)} size="180px" delay="-2s" back={approved.source} />
                ) : <p className="dash-note">No approved selling rate. Nothing can be sold at zero.</p>}
              </div>
            </article>
          ) : null}
          {seeSales ? (
            <article className="dash-card dash-sales">
              <div className="dash-row"><h2>Sales</h2></div>
              <p className="dash-big dash-dp">{money(sales)}</p>
              <p className="dash-mute">{completed.length} completed {completed.length === 1 ? 'invoice' : 'invoices'}</p>
              <Spark values={completed.map((invoice) => invoice.totalCents)} />
            </article>
          ) : null}
          <article className="dash-card dash-stock">
            <div className="dash-row"><h2>Gold in stock</h2><span className="dash-mute">Total <b>{stockGrams.toFixed(1)} g</b> · {available.length} pieces</span></div>
            <ul className="dash-vault">
              {purities.map((purity, index) => (
                <li key={purity} className="dash-vault-row dash-dp">
                  <span className="dash-seal" aria-hidden="true"><GemMark /></span>
                  <span>
                    <b>{purity}</b>
                    <span className="dash-mute">{purityLabel[purity]} · {counts[index]} {counts[index] === 1 ? 'piece' : 'pieces'}</span>
                    <span className="dash-share"><i style={{ '--p': stockGrams ? (grams[index] ?? 0) / stockGrams : 0 } as CSSProperties} /></span>
                  </span>
                  <strong>{(grams[index] ?? 0).toFixed(1)} g</strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="dash-card dash-attn">
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

function Coin({ purity, figure, size, delay, back }: { purity: string; figure: string; size: string; delay: string; back: string }) {
  const [flip, setFlip] = useState(false)
  return (
    <button type="button" className={`dash-coin ${flip ? 'flip' : ''}`} style={{ '--sz': size, '--dl': delay } as CSSProperties} aria-label={`${purity} ${figure} LKR per gram`} onClick={() => setFlip((open) => !open)}>
      <span className="dash-cf">
        <span className="dash-face dash-front">
          <small>{purity} · {purityLabel[purity]}</small>
          <b>{figure}</b>
          <small>LKR / g</small>
        </span>
        <span className="dash-face dash-back">
          <small>{purity}</small>
          <b>{back}</b>
        </span>
      </span>
    </button>
  )
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = Math.max(max - min, 1)
  const line = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 300
    const y = 92 - ((value - min) / span) * 70
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 300 110" className="dash-spark" aria-hidden="true">
      <path d={`${line} L300 110 L0 110 Z`} fill="rgba(201,162,77,.35)" />
      <path d={line} fill="none" stroke="#8A6A24" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
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
