import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { moduleOpen } from '../../access.ts'
import type { Shop } from '../../desk.ts'
import { CountUp } from './countUp.tsx'

const photos: Record<string, string> = {
  Rings: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=160&h=160&q=70',
  Necklaces: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=160&h=160&q=70',
  Earrings: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=160&h=160&q=70',
  Pendants: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=160&h=160&q=70',
  Bangles: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=160&h=160&q=70',
}

const day = 86_400_000

function motionOff() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'off'
}

/** Sale time comes from the audit line written when the invoice was posted. Undated invoices are left out. */
function saleTime(desk: Shop, invoiceId: string) {
  const stamped = desk.audit.find((entry) => entry.action === `sale.completed:${invoiceId}`)
  if (!stamped) return null
  const at = Date.parse(stamped.at)
  return Number.isFinite(at) ? at : null
}

/** Days since the piece was added, received, or returned to the case. Seed pieces with no such event stay undated. */
function daysOnHand(desk: Shop, tag: string, now: number) {
  const stamps: number[] = []
  for (const entry of desk.audit) {
    if (entry.action === `product.added:${tag}`) stamps.push(Date.parse(entry.at))
    if (entry.action.startsWith('purchase.confirmed:')) {
      const id = entry.action.slice('purchase.confirmed:'.length)
      if (desk.purchases.some((purchase) => purchase.id === id && purchase.tag === tag)) stamps.push(Date.parse(entry.at))
    }
    if (entry.action.startsWith('sale.returned:')) {
      const id = entry.action.slice('sale.returned:'.length)
      if (desk.invoices.some((invoice) => invoice.id === id && invoice.tag === tag)) stamps.push(Date.parse(entry.at))
    }
  }
  const known = stamps.filter((value) => Number.isFinite(value))
  if (known.length === 0) return null
  return Math.max(0, Math.floor((now - Math.max(...known)) / day))
}

function topSelling(desk: Shop, days: number, now: number) {
  const since = now - days * day
  const totals = new Map<string, { units: number; revenue: number }>()
  for (const invoice of desk.invoices) {
    if (invoice.status !== 'completed' && invoice.status !== 'credit') continue
    const at = saleTime(desk, invoice.id)
    if (at === null || at < since) continue
    const current = totals.get(invoice.tag) ?? { units: 0, revenue: 0 }
    current.units += 1
    current.revenue += invoice.totalCents
    totals.set(invoice.tag, current)
  }
  return [...totals.entries()]
    .map(([tag, stats]) => ({ tag, ...stats, item: desk.items.find((entry) => entry.tag === tag) }))
    .filter((row) => row.item)
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 5)
}

function slowMoving(desk: Shop, days: number, now: number) {
  const since = now - days * day
  const moved = new Set<string>()
  for (const invoice of desk.invoices) {
    if (invoice.status === 'returned') continue
    const at = saleTime(desk, invoice.id)
    if (at !== null && at >= since) moved.add(invoice.tag)
  }
  return desk.items
    .filter((item) => item.status === 'available' && !moved.has(item.tag))
    .map((item) => ({ item, age: daysOnHand(desk, item.tag, now) }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1) || b.item.costCents - a.item.costCents)
    .slice(0, 5)
}

export function ItemPerformance({ desk, showRevenue, showCost }: { desk: Shop; showRevenue: boolean; showCost: boolean }) {
  const [tab, setTab] = useState<'top' | 'slow'>('top')
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [ready, setReady] = useState(() => motionOff())
  const leaders = useMemo(() => topSelling(desk, days, Date.now()), [desk, days])
  const quiet = useMemo(() => slowMoving(desk, days, Date.now()), [desk, days])
  const canOpen = moduleOpen(desk, '/products')
  const topUnits = leaders[0]?.units ?? 0

  useEffect(() => {
    if (motionOff()) {
      setReady(true)
      return
    }
    setReady(false)
    const timer = window.setTimeout(() => setReady(true), 220)
    return () => window.clearTimeout(timer)
  }, [tab, days])

  return (
    <article className="dash-card dash-perform dash-reveal" style={{ '--rd': '320ms' } as CSSProperties}>
      <div className="perf-head">
        <h2>Item performance</h2>
        <div className="perf-tools">
          <div className="perf-tabs" data-tab={tab} role="tablist" aria-label="Item performance">
            <i aria-hidden="true" />
            <button type="button" role="tab" aria-selected={tab === 'top'} onClick={() => setTab('top')}>Top selling</button>
            <button type="button" role="tab" aria-selected={tab === 'slow'} onClick={() => setTab('slow')}>Slow-moving</button>
          </div>
          <select className="perf-period" aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>
      {ready ? (
        tab === 'top' ? (
          leaders.length === 0 ? (
            <Empty text={`No pieces sold in the last ${days} days.`} />
          ) : (
            <ul className="perf-list" key={`top-${days}`}>
              {leaders.map((row, index) => (
                <PerformanceRow key={row.tag} index={index} lead={index === 0} tag={row.tag} name={row.item?.name ?? row.tag} category={row.item?.category ?? ''} purity={row.item?.purity ?? ''} href={canOpen ? `/products#${row.tag}` : null} stats={
                  <span className="perf-nums">
                    <b><CountUp to={row.units} kind="count" /> sold</b>
                    {showRevenue ? <span><CountUp to={row.revenue} kind="lkr" /></span> : null}
                    <ShareBar share={topUnits ? row.units / topUnits : 0} />
                  </span>
                } />
              ))}
            </ul>
          )
        ) : quiet.length === 0 ? (
          <Empty text="Nothing is sitting unsold in this period." />
        ) : (
          <ul className="perf-list" key={`slow-${days}`}>
            {quiet.map((row, index) => (
              <PerformanceRow key={row.item.tag} index={index} tag={row.item.tag} name={row.item.name} category={row.item.category} purity={row.item.purity} href={canOpen ? `/products#${row.item.tag}` : null} stats={
                <span className="perf-nums">
                  <b title={row.age === null ? 'No receipt date on the books' : undefined}>{row.age === null ? '—' : <><CountUp to={row.age} kind="count" /> days</>}</b>
                  <span><CountUp to={Number(row.item.netGrams)} kind="grams" /></span>
                  {showCost ? <span><CountUp to={row.item.costCents} kind="lkr" /></span> : null}
                  <AgeBadge days={row.age} />
                </span>
              } extra={canOpen ? <Link className="perf-discount" to={`/products#${row.item.tag}`}>Discount</Link> : null} />
            ))}
          </ul>
        )
      ) : (
        <ul className="perf-list" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <li key={index} className="perf-skel" />)}
        </ul>
      )}
    </article>
  )
}

function PerformanceRow({ index, lead = false, tag, name, category, purity, href, stats, extra }: {
  index: number
  lead?: boolean
  tag: string
  name: string
  category: string
  purity: string
  href: string | null
  stats: ReactNode
  extra?: ReactNode
}) {
  const photo = photos[category]
  const body = (
    <>
      <span className="perf-rank">{lead ? <Crown /> : null}{index + 1}</span>
      {photo ? <img src={photo} alt="" /> : <Gem />}
      <span className="perf-copy">
        <b>{name}</b>
        <span className="dash-mute">{category} · {purity}</span>
        <span className="dash-mute">{tag}</span>
      </span>
      {stats}
    </>
  )
  return (
    <li className="perf-row" style={{ '--rd': `${index * 50}ms` } as CSSProperties}>
      {href ? <Link className="perf-open" to={href}>{body}</Link> : <div className="perf-open">{body}</div>}
      {extra}
    </li>
  )
}

function ShareBar({ share }: { share: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const paint = () => node.classList.add('in')
    if (motionOff()) {
      paint()
      return
    }
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      paint()
      return
    }
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      watcher.disconnect()
      paint()
    })
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [share])
  return <span ref={ref} className="perf-bar"><i style={{ '--p': share } as CSSProperties} /></span>
}

function AgeBadge({ days }: { days: number | null }) {
  if (days === null || days < 30) return null
  const hot = days >= 60
  return <em className={hot ? 'age-red' : 'age-amber'}>{hot ? '60+ days' : '30–60 days'}</em>
}

function Empty({ text }: { text: string }) {
  return (
    <p className="perf-empty">
      <Gem />
      <span>{text}</span>
    </p>
  )
}

function Crown() {
  return (
    <svg className="perf-crown" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17h18L19 8l-5 4-2-6-2 6-5-4z" />
    </svg>
  )
}

function Gem() {
  return (
    <span className="perf-gem" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M6 3h12l4 6-10 12L2 9z" />
        <path d="M2 9h20M9 3l3 6 3-6" />
      </svg>
    </span>
  )
}
