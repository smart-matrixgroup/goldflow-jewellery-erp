import { useEffect, useMemo, useRef, useState } from 'react'
import { centsToLkrString } from '@goldflow/shared'
import { DeskBackdrop, useHoverLight } from './ambient.tsx'
import { addCustomer, quoteBreakdown, quoteItem, sell, type DeskItem, type Shop } from './desk.ts'
import type { LiveBoard } from './liveGold.ts'
import { changeDue, type Tender } from './posMoney.ts'
import type { Run } from './pages.tsx'
import { money, rupees } from './ui.tsx'

const photos: Record<string, string> = {
  Rings: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=640&h=640&q=80',
  Necklaces: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=640&h=640&q=80',
  Earrings: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=640&h=640&q=80',
  Pendants: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=640&h=640&q=80',
  Bangles: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=640&h=640&q=80',
}

type Stage = 'items' | 'confirm' | 'pay' | 'bill'
type PayMethod = 'cash' | 'card' | 'bank_transfer' | 'credit' | 'split'
type SplitRow = { id: string; method: 'cash' | 'card' | 'bank_transfer'; amount: string }

type SlipLine = {
  name: string
  tag: string
  purity: string
  grams: string
  total: number
  discount: number
  metal: number
  making: number
  wastage: number
  stones: number
  tax: number
  subtotal: number
  rate: number
  rateSource: string
  rateAt: string
  rateLabel: string
}

type Slip = {
  at: string
  invoices: string[]
  customer: string
  phone: string
  cashier: string
  method: string
  lines: SlipLine[]
  discount: number
  tax: number
  credit: number
  total: number
  tender: number
  change: number
  balance: number
  last4: string
  approval: string
  reference: string
  duplicate: boolean
}

const steps: { id: Stage; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'pay', label: 'Payment' },
  { id: 'bill', label: 'Bill' },
]

export function Pos({
  desk,
  run,
  cashier,
  onClose,
}: {
  desk: Shop
  run: Run
  board: LiveBoard | null
  cashier: string
  onClose: () => void
}) {
  useHoverLight()
  const searchRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const saleKeys = useRef<Record<string, string>>({})
  const posting = useRef(false)
  const [stage, setStage] = useState<Stage>('items')
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<string[]>([])
  const [held, setHeld] = useState<string[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding] = useState(false)
  const [named, setNamed] = useState(false)
  const [method, setMethod] = useState<PayMethod>('cash')
  const [amount, setAmount] = useState('')
  const [splits, setSplits] = useState<SplitRow[]>([
    { id: 'cash', method: 'cash', amount: '' },
    { id: 'card', method: 'card', amount: '' },
  ])
  const [last4, setLast4] = useState('')
  const [approval, setApproval] = useState('')
  const [reference, setReference] = useState('')
  const [openLine, setOpenLine] = useState<string | null>(null)
  const [discounts, setDiscounts] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pulse, setPulse] = useState<string | null>(null)
  const [confirmAdd, setConfirmAdd] = useState<{ name: string; detail: string; price: string } | null>(null)
  const [slip, setSlip] = useState<Slip | null>(null)
  const [paper, setPaper] = useState<'80' | 'a4'>('80')
  const [copies, setCopies] = useState(0)
  const customer = desk.customers.find((entry) => entry.id === customerId)
  const needle = customerQuery.trim().toLowerCase()
  const matches = needle
    ? desk.customers.filter((person) => `${person.name} ${person.phone}`.toLowerCase().includes(needle))
    : []
  const categories = ['All', ...new Set(desk.items.map((item) => item.category))]
  const lines = cart.flatMap((tag) => {
    const item = desk.items.find((entry) => entry.tag === tag && entry.status === 'available')
    if (!item) return []
    const priced = linePrice(desk, item, discounts[tag])
    return [{ item, price: priced.price, manual: priced.manual, blocked: priced.blocked }]
  })
  const total = lines.reduce((sum, line) => sum + (line.price?.totalCents ?? 0), 0)
  const tax = lines.reduce((sum, line) => sum + (line.price?.taxCents ?? 0), 0)
  const discount = lines.reduce((sum, line) => sum + (line.price?.discountCents ?? 0), 0)
  const oldGold = Math.min(customer?.oldGoldCents ?? 0, total)
  const bill = changeDue(total, 0, oldGold)
  const tender = useMemo(() => readRupees(amount), [amount])
  const settled = changeDue(total, tender ?? 0, oldGold)
  const splitCents = splits.map((row) => ({ ...row, cents: readRupees(row.amount) }))
  const splitTotal = splitCents.reduce((sum, row) => sum + (row.cents ?? 0), 0)
  const shown = desk.items.filter((item) => {
    const inCategory = category === 'All' || item.category === category
    const needle = query.trim().toLowerCase()
    return inCategory && (!needle || `${item.tag} ${item.name} ${item.category}`.toLowerCase().includes(needle))
  })
  const missingRate = lines.some((line) => !line.price)
  const confirmBlock = lines.length === 0
    ? 'Add a piece first.'
    : lines.some((line) => line.blocked)
      ? 'A discount above LKR 10,000 needs a manager.'
        : missingRate
          ? 'A piece has no approved selling rate.'
          : null
  const payBlock = method === 'credit' && !customer
    ? 'Credit needs a named customer.'
    : payReason(method, tender, bill.owing, splitTotal, splitCents.some((row) => row.cents === null), last4)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!confirmAdd) return
    const timer = window.setTimeout(() => setConfirmAdd(null), 1700)
    return () => window.clearTimeout(timer)
  }, [confirmAdd])

  useEffect(() => {
    if (stage === 'items' || stage === 'bill') return
    const root = sheetRef.current
    if (!root) return
    const focusable = () => [...root.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter((node) => !node.hasAttribute('disabled'))
    focusable()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const nodes = focusable()
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [stage])

  function add(tag: string) {
    const item = desk.items.find((entry) => entry.tag === tag)
    if (!item || item.status !== 'available') {
      setNotice(item ? `${item.name} is already sold.` : 'That tag is not on this desk.')
      return
    }
    const price = safeBreakdown(desk, tag)
    if (!price) {
      setNotice(`${item.name} has no approved selling rate, so it cannot be added.`)
      return
    }
    const already = cart.includes(tag)
    setCart((current) => (current.includes(tag) ? current : [...current, tag]))
    setNotice(null)
    setStage('items')
    setPulse(tag)
    window.setTimeout(() => setPulse((current) => (current === tag ? null : current)), 600)
    setConfirmAdd({
      name: item.name,
      detail: already ? 'Already on this bill' : 'Added to the bill',
      price: money(price.totalCents),
    })
  }

  function takeSearch() {
    const found = matchTag(desk.items.filter((item) => item.status === 'available'), query)
    if (found) {
      add(found.tag)
      setQuery('')
      return
    }
    const open = shown.filter((item) => item.status === 'available')
    if (query.trim() && open.length === 1 && open[0]) add(open[0].tag)
    else if (query.trim()) setNotice(`No available tag in “${query.trim()}”.`)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        setStage('items')
        searchRef.current?.focus()
      } else if (event.key === 'F8' && stage === 'items' && !confirmBlock) {
        event.preventDefault()
        setStage('confirm')
      } else if (event.key === 'F9' && stage === 'confirm') {
        event.preventDefault()
        setStage('pay')
      } else if (event.key === 'Escape' && stage !== 'items') {
        event.preventDefault()
        setStage(stage === 'bill' ? 'items' : stage === 'pay' ? 'confirm' : 'items')
      } else if (event.key === 'Enter' && stage === 'items' && document.activeElement === searchRef.current) {
        event.preventDefault()
        takeSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function acceptPhone() {
    const phone = newPhone.trim()
    if (!phone) return
    const found = desk.customers.find((person) => person.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''))
    if (found) {
      setCustomerId(found.id)
      setCustomerQuery('')
      setNewName('')
      setNewPhone('')
      setAdding(false)
      setNamed(false)
      setNotice(`${found.name} is already on the books.`)
      return
    }
    setNamed(true)
    setNotice(null)
  }

  function saveCustomer() {
    const name = newName.trim()
    const phone = newPhone.trim()
    if (!phone || !name) return
    const id = `C${desk.customers.length + 1}`
    run((current) => addCustomer(current, name, phone))
    setCustomerId(id)
    setCustomerQuery('')
    setNewName('')
    setNewPhone('')
    setAdding(false)
    setNamed(false)
  }

  function chooseMethod(next: PayMethod) {
    setMethod(next)
    if ((next === 'card' || next === 'bank_transfer') && !amount.trim()) setAmount(centsToLkrString(bill.owing))
  }

  function typeAmount(key: string) {
    setAmount((current) => {
      if (key === 'C') return ''
      if (key === 'Del') return current.slice(0, -1)
      if (key === '.' && current.includes('.')) return current
      return `${current}${key}`
    })
  }

  function postSale() {
    if (posting.current || confirmBlock || payBlock || tender === null && method !== 'split') return
    posting.current = true
    setBusy(true)
    const snapshot = lines.flatMap((line) => {
      if (!line.price) return []
      return [{
        tag: line.item.tag,
        cents: line.manual ? line.price.discountCents : null,
        line: slipLine(line.item, line.price),
      }]
    })
    const slices: Tender[] = method === 'split'
      ? splitCents.flatMap((row) => (row.cents && row.cents > 0 ? [{ method: row.method, cents: row.cents }] : []))
      : [{ method: method === 'credit' ? 'cash' : method, cents: Math.min(tender ?? 0, bill.owing) }]
    let failed = false
    let posted: Slip | null = null
    run((shop) => {
      try {
        let next = shop
        let buyerId = customerId
        if (!buyerId) {
          const walk = next.customers.find((entry) => entry.name === 'Walk-in' && entry.phone === '')
          if (walk) buyerId = walk.id
          else {
            next = addCustomer(next, 'Walk-in', '')
            buyerId = next.customers[next.customers.length - 1]?.id ?? ''
          }
        }
        const pools = slices.map((slice) => ({ ...slice }))
        for (const line of snapshot) {
          const pricedShop = line.cents === null ? next : withDiscount(next, line.tag, line.cents)
          const price = quoteItem(pricedShop, line.tag)
          const person = pricedShop.customers.find((entry) => entry.id === buyerId)
          let cashNeed = Math.max(0, price - Math.min(person?.oldGoldCents ?? 0, price))
          const payments: Tender[] = []
          for (const pool of pools) {
            if (cashNeed <= 0) break
            const use = Math.min(pool.cents, cashNeed)
            if (use > 0) {
              payments.push({ method: pool.method, cents: use })
              pool.cents -= use
              cashNeed -= use
            }
          }
          next = sell(line.cents === null ? next : withDiscount(next, line.tag, line.cents), {
            tag: line.tag,
            customerId: buyerId,
            payments,
            key: saleKeys.current[line.tag] ??= `till-${line.tag}-${crypto.randomUUID()}`,
          })
        }
        const created = next.invoices.slice(shop.invoices.length)
        posted = {
          at: new Date().toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }),
          invoices: created.map((invoice) => invoice.id),
          customer: customer?.name ?? 'Walk-in',
          phone: customer?.phone ?? '',
          cashier,
          method: methodLabel(method),
          lines: snapshot.map((entry) => entry.line),
          discount,
          tax,
          credit: oldGold,
          total,
          tender: method === 'split' ? splitTotal : tender ?? 0,
          change: method === 'cash' ? settled.change : 0,
          balance: method === 'credit' ? Math.max(0, bill.owing - (tender ?? 0)) : created.reduce((sum, invoice) => sum + (invoice.totalCents - invoice.paidCents), 0),
          last4,
          approval,
          reference,
          duplicate: false,
        }
        return next
      } catch (error) {
        failed = true
        setNotice(error instanceof Error ? error.message : 'The sale was not posted. The bill is still here.')
        throw error
      }
    })
    posting.current = false
    setBusy(false)
    if (failed || !posted) return
    setSlip(posted)
    setCart([])
    setAmount('')
    setDiscounts({})
    setCopies(0)
    setStage('bill')
    setNotice(null)
  }

  return (
    <div className="till bg-canvas relative grid h-svh grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-ink">
      <DeskBackdrop />
      <header className="bg-header flex h-16 items-center gap-3 border-b border-line px-4">
        <button type="button" className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm" onClick={onClose}>Desk</button>
        <span className="mark grid h-9 w-9 place-items-center rounded-xl" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 9h18L12 21 3 9zM3 9l4-5h10l4 5" /></svg>
        </span>
        <span className="font-serif text-lg leading-none">GoldFlow</span>
        <ol className="mx-auto hidden items-center gap-2 text-sm md:flex">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center gap-2">
              <span className={stage === step.id ? 'text-numeral font-semibold' : 'text-muted'}>{index + 1}. {step.label}</span>
              {index < steps.length - 1 ? <span className="text-faint" aria-hidden="true">→</span> : null}
            </li>
          ))}
        </ol>
        <span className="ml-auto text-right text-xs">
          <span className="block">{cashier}</span>
          <span className="text-faint">Ward Place</span>
        </span>
      </header>
      {missingRate ? <p className="border-b border-line bg-[var(--mix-blush)] px-4 py-2 text-sm text-[var(--danger)]">No approved selling rate. Nothing can be sold at zero.</p> : null}
      {notice ? <p className="border-b border-line px-4 py-2 text-sm text-[var(--warn)]" role="status">{notice}</p> : null}
      {stage === 'items' ? (
        <div className="grid min-h-0 min-[1024px]:grid-cols-[minmax(0,65%)_minmax(280px,35%)]">
          <section className="min-h-0 overflow-auto p-4">
            <form onSubmit={(event) => { event.preventDefault(); takeSearch() }}>
              <input ref={searchRef} className="h-12 w-full rounded-2xl border border-line bg-field px-4 text-base" placeholder="Scan tag or type name" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Scan tag or type name" />
            </form>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {categories.map((entry) => {
                const count = desk.items.filter((item) => entry === 'All' || item.category === entry).length
                return (
                  <button key={entry} type="button" className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${category === entry ? 'bg-accent text-on-accent' : 'text-muted border border-line'}`} onClick={() => setCategory(entry)}>
                    {entry} · {count}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => {
                const price = item.status === 'available' ? safeBreakdown(desk, item.tag) : null
                const open = item.status === 'available' && price
                return (
                  <button key={item.tag} type="button" disabled={!open} className={`hover-surface bg-paper overflow-hidden rounded-2xl border border-line text-left ${pulse === item.tag ? 'tile-added' : ''} ${open ? '' : 'opacity-50'}`} onClick={() => add(item.tag)}>
                    {photos[item.category] ? <img src={photos[item.category]} alt="" className="tile-photo h-40 w-full object-cover" /> : <Gem />}
                    <span className="block p-3">
                      <span className="block font-medium">{item.name}</span>
                      <span className="mt-2 flex flex-wrap gap-1 text-xs">
                        <span className="rounded-full bg-[var(--mix-champagne)] px-2 py-1 text-[var(--gold-text)]">{item.purity}</span>
                        <span className="rounded-full bg-[var(--mix-sky)] px-2 py-1">{item.netGrams} g</span>
                        <span className={`rounded-full px-2 py-1 ${open ? 'bg-[var(--mix-mint)] text-[var(--ok)]' : 'bg-[var(--mix-blush)] text-[var(--danger)]'}`}>{open ? 'Available' : 'Sold'}</span>
                      </span>
                      <span className="text-numeral mt-2 block font-serif text-xl tabular-nums">{price ? money(price.totalCents) : '—'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
          <Bill
            lines={lines}
            customerQuery={customerQuery}
            setCustomerQuery={setCustomerQuery}
            matches={matches}
            customerId={customerId}
            setCustomerId={setCustomerId}
            adding={adding}
            setAdding={setAdding}
            named={named}
            setNamed={setNamed}
            acceptPhone={acceptPhone}
            newName={newName}
            setNewName={setNewName}
            newPhone={newPhone}
            setNewPhone={setNewPhone}
            saveCustomer={saveCustomer}
            discounts={discounts}
            setDiscounts={setDiscounts}
            openLine={openLine}
            setOpenLine={setOpenLine}
            remove={(tag) => setCart((current) => current.filter((entry) => entry !== tag))}
            tax={tax}
            discount={discount}
            oldGold={oldGold}
            total={total}
            confirmBlock={confirmBlock}
            onConfirm={() => setStage('confirm')}
            onHold={() => { setHeld(cart); setCart([]) }}
            onClear={() => setCart([])}
            held={held.length}
            onResume={() => { setCart(held); setHeld([]) }}
          />
        </div>
      ) : null}
      {stage === 'confirm' ? (
        <section ref={sheetRef} className="mx-auto flex min-h-0 w-full max-w-xl flex-col overflow-auto p-4">
          <h1 className="font-serif text-3xl">Check the bill</h1>
          <p className="text-muted mt-1 text-sm">{customer ? `${customer.name} · ${customer.phone || 'No phone'}` : 'Walk-in · no customer selected'} · {cashier}</p>
          <ul className="mt-4 grid gap-2">
            {lines.map((line) => (
              <li key={line.item.tag} className="flex justify-between gap-3 border-b border-line py-2 text-sm">
                <span>{line.item.name}<span className="text-faint block text-xs">{line.item.tag} · {line.item.purity} · {line.item.netGrams} g · discount {money(line.price?.discountCents ?? 0)}</span></span>
                <span className="tabular-nums">{line.price ? money(line.price.totalCents) : '—'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between text-sm"><span>Tax</span><span className="tabular-nums">{money(tax)}</span></p>
          <p className="text-numeral mt-2 flex justify-between font-serif text-3xl"><span>Total</span><span className="tabular-nums">{money(total)}</span></p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-xl border border-line" onClick={() => setStage('items')}>Back</button>
            <button type="button" className="btn-accent min-h-11 flex-1 rounded-xl font-semibold" onClick={() => setStage('pay')}>Continue to payment</button>
          </div>
        </section>
      ) : null}
      {stage === 'pay' ? (
        <section ref={sheetRef} className="mx-auto grid min-h-0 w-full max-w-3xl gap-4 overflow-auto p-4">
          <h1 className="font-serif text-3xl">How is the customer paying?</h1>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(['cash', 'card', 'bank_transfer', 'credit', 'split'] as const).map((entry) => (
              <button key={entry} type="button" className={`min-h-11 rounded-xl text-sm ${method === entry ? 'bg-accent text-on-accent' : 'border border-line'}`} onClick={() => chooseMethod(entry)}>
                {methodLabel(entry)}
              </button>
            ))}
          </div>
          <p className="text-numeral font-serif text-3xl tabular-nums">Due {money(bill.owing)}</p>
          {method === 'split' ? (
            <div className="grid gap-2">
              {splits.map((row) => (
                <div key={row.id} className="grid grid-cols-[8rem_1fr] gap-2">
                  <select className="min-h-11 rounded-xl border border-line bg-field px-2" value={row.method} aria-label="Split method" onChange={(event) => setSplits((current) => current.map((entry) => entry.id === row.id ? { ...entry, method: event.target.value as SplitRow['method'] } : entry))}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                  <input className="min-h-11 rounded-xl border border-line bg-field px-3 text-right tabular-nums" inputMode="decimal" aria-label="Split amount" value={row.amount} onChange={(event) => setSplits((current) => current.map((entry) => entry.id === row.id ? { ...entry, amount: event.target.value } : entry))} />
                </div>
              ))}
              <button type="button" className="min-h-11 rounded-xl border border-line text-sm" onClick={() => setSplits((current) => [...current, { id: `s${current.length + 1}`, method: 'cash', amount: '' }])}>Add a method</button>
              <p className="text-sm">Remaining {money(Math.max(0, bill.owing - splitTotal))}</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
              <div>
                <label className="text-muted grid gap-1 text-xs">
                  {method === 'credit' ? 'Amount received now' : 'Amount received'}
                  <input className="min-h-12 rounded-xl border border-line bg-field px-3 text-right text-2xl tabular-nums" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </label>
                {method === 'card' ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-muted grid gap-1 text-xs">Last 4 digits
                      <input className="min-h-11 rounded-xl border border-line bg-field px-3" inputMode="numeric" maxLength={4} value={last4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, '').slice(0, 4))} />
                    </label>
                    <label className="text-muted grid gap-1 text-xs">Approval code
                      <input className="min-h-11 rounded-xl border border-line bg-field px-3" value={approval} onChange={(event) => setApproval(event.target.value)} />
                    </label>
                  </div>
                ) : null}
                {method === 'bank_transfer' ? (
                  <label className="text-muted mt-3 grid gap-1 text-xs">Transfer reference
                    <input className="min-h-11 rounded-xl border border-line bg-field px-3" value={reference} onChange={(event) => setReference(event.target.value)} />
                  </label>
                ) : null}
                {method === 'credit' ? <p className="text-muted mt-2 text-sm">Amount still owed {money(Math.max(0, bill.owing - (tender ?? 0)))}. A bill with nothing received is not stored.</p> : null}
                {method === 'cash' ? <p className="mt-2 font-serif text-2xl tabular-nums">{settled.balance > 0 ? `Balance ${money(settled.balance)}` : `Change due ${money(settled.change)}`}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => setAmount(centsToLkrString(bill.owing))}>Exact</button>
                  {[100, 500, 1000].map((step) => (
                    <button key={step} type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => setAmount(centsToLkrString(roundUp(bill.owing, step)))}>Next {step}</button>
                  ))}
                </div>
              </div>
              {method === 'cash' || method === 'credit' ? <Numpad onKey={typeAmount} /> : null}
            </div>
          )}
          {payBlock ? <p className="text-sm text-[var(--warn)]">{payBlock}</p> : null}
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-xl border border-line" onClick={() => setStage('confirm')}>Back</button>
            <button type="button" className="btn-accent min-h-11 flex-1 rounded-xl font-semibold disabled:opacity-40" disabled={Boolean(payBlock) || busy} onClick={postSale}>{busy ? 'Posting…' : 'Complete sale'}</button>
          </div>
        </section>
      ) : null}
      {stage === 'bill' && slip ? (
        <section ref={sheetRef} className="grid min-h-0 place-items-center overflow-auto p-4">
          <Receipt slip={{ ...slip, duplicate: copies > 0 }} paper={paper} onPaper={setPaper} onPrint={() => { window.print(); setCopies((count) => count + 1) }} onNew={() => { setSlip(null); setStage('items'); searchRef.current?.focus() }} />
        </section>
      ) : null}
      {confirmAdd ? (
        <div className="add-confirm" role="status">
          <span className="add-ring">✓</span>
          <p className="text-xs tracking-[0.16em] uppercase">{confirmAdd.detail}</p>
          <p className="font-serif text-xl">{confirmAdd.name}</p>
          <p className="tabular-nums">{confirmAdd.price}</p>
        </div>
      ) : null}
    </div>
  )
}

function Bill(props: {
  lines: { item: DeskItem; price: ReturnType<typeof safeBreakdown>; manual: boolean; blocked: boolean }[]
  customerQuery: string
  setCustomerQuery: (value: string) => void
  matches: Shop['customers']
  customerId: string
  setCustomerId: (id: string) => void
  adding: boolean
  setAdding: (value: boolean | ((open: boolean) => boolean)) => void
  named: boolean
  setNamed: (value: boolean) => void
  acceptPhone: () => void
  newName: string
  setNewName: (value: string) => void
  newPhone: string
  setNewPhone: (value: string) => void
  saveCustomer: () => void
  discounts: Record<string, string>
  setDiscounts: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  openLine: string | null
  setOpenLine: (tag: string | null) => void
  remove: (tag: string) => void
  tax: number
  discount: number
  oldGold: number
  total: number
  confirmBlock: string | null
  onConfirm: () => void
  onHold: () => void
  onClear: () => void
  held: number
  onResume: () => void
}) {
  return (
    <aside className="desk-hero flex min-h-0 flex-col border-t border-line min-[1024px]:border-t-0 min-[1024px]:border-l">
      <div className="border-b border-line p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Existing customer</p>
          <button type="button" className="min-h-11 text-sm" onClick={() => { props.setNamed(false); props.setAdding((open) => !open) }}>{props.adding ? 'Existing' : 'New customer'}</button>
        </div>
        {props.adding ? (
          <div className="mt-2 grid gap-2">
            <input className="min-h-11 rounded-xl border border-line bg-field px-3 text-sm" placeholder="Phone number" aria-label="New customer phone" inputMode="tel" value={props.newPhone} onChange={(event) => { props.setNewPhone(event.target.value); props.setNamed(false) }} />
            {props.named ? (
              <input className="min-h-11 rounded-xl border border-line bg-field px-3 text-sm" placeholder="Name" aria-label="New customer name" value={props.newName} onChange={(event) => props.setNewName(event.target.value)} />
            ) : null}
            {props.named ? (
              <button type="button" className="btn-accent min-h-11 rounded-xl text-sm font-semibold" onClick={props.saveCustomer}>Add customer</button>
            ) : (
              <button type="button" className="btn-accent min-h-11 rounded-xl text-sm font-semibold" onClick={props.acceptPhone}>Add</button>
            )}
          </div>
        ) : (
          <>
            <input className="mt-2 min-h-11 w-full rounded-xl border border-line bg-field px-3 text-sm" placeholder="Search name or mobile" aria-label="Find customer" value={props.customerQuery} onChange={(event) => props.setCustomerQuery(event.target.value)} />
            <p className="text-muted mt-2 text-xs">{props.customerId ? 'Customer selected.' : 'No customer selected. A walk-in can still be billed.'}</p>
            <ul className="mt-2 grid max-h-28 gap-1 overflow-auto">
              {props.matches.map((person) => (
                <li key={person.id}>
                  <button type="button" className={`min-h-11 w-full rounded-lg px-2 text-left text-sm ${person.id === props.customerId ? 'bg-[var(--mix-mint)]' : ''}`} onClick={() => props.setCustomerId(person.id)}>
                    {person.name}<span className="text-faint block text-xs">{person.phone || 'No phone'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-auto px-3">
        {props.lines.map((line) => (
          <li key={line.item.tag} className="border-b border-line py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span>{line.item.name}<span className="text-faint block text-xs">{line.item.tag}</span></span>
              <span className="text-right">
                <span className="block tabular-nums">{line.price ? money(line.price.totalCents) : '—'}</span>
                <button type="button" className="min-h-11 text-xs" onClick={() => props.remove(line.item.tag)}>Remove</button>
              </span>
            </div>
            <button type="button" className="min-h-11 text-xs" onClick={() => props.setOpenLine(props.openLine === line.item.tag ? null : line.item.tag)}>{props.openLine === line.item.tag ? 'Hide breakdown' : 'Price breakdown'}</button>
            {props.openLine === line.item.tag && line.price ? (
              <div className="text-muted grid gap-1 text-xs">
                <span className="flex justify-between">Metal <span className="tabular-nums">{money(line.price.metalValueCents)}</span></span>
                <span className="flex justify-between">Making <span className="tabular-nums">{money(line.price.makingChargeCents)}</span></span>
                <span className="flex justify-between">Wastage <span className="tabular-nums">{money(line.price.wastageChargeCents)}</span></span>
                <span className="flex justify-between">Stones <span className="tabular-nums">{money(line.price.stoneValueCents)}</span></span>
              </div>
            ) : null}
            <label className="text-muted mt-1 flex items-center gap-2 text-xs">
              Discount
              <input className="min-h-11 w-28 rounded-lg border border-line bg-field px-2 text-right" inputMode="decimal" aria-label={`Discount for ${line.item.tag}`} value={props.discounts[line.item.tag] ?? ''} onChange={(event) => props.setDiscounts((current) => ({ ...current, [line.item.tag]: event.target.value }))} />
            </label>
            {line.blocked ? <span className="text-xs text-[var(--danger)]">Above LKR 10,000 needs a manager.</span> : null}
          </li>
        ))}
        {props.lines.length === 0 ? <li className="text-muted py-6 text-sm">Scan or tap a piece.</li> : null}
      </ul>
      <div className="grid gap-1 border-t border-line px-3 py-2 text-sm">
        <p className="flex justify-between"><span>Discount</span><span className="tabular-nums">{money(props.discount)}</span></p>
        <p className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(props.tax)}</span></p>
        {props.oldGold > 0 ? <p className="flex justify-between"><span>Old-gold credit</span><span className="tabular-nums">{money(props.oldGold)}</span></p> : null}
        <p className="text-numeral flex justify-between font-serif text-3xl"><span>Total</span><span className="tabular-nums">{money(props.total)}</span></p>
      </div>
      {props.confirmBlock ? <p className="text-muted px-3 text-xs">{props.confirmBlock}</p> : null}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 p-3">
        <button type="button" className="btn-accent min-h-11 rounded-xl font-semibold disabled:opacity-40" disabled={Boolean(props.confirmBlock)} onClick={props.onConfirm}>Confirm</button>
        <button type="button" className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={props.onHold}>Hold</button>
        <button type="button" className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={props.onClear}>Clear</button>
      </div>
      {props.held > 0 ? <button type="button" className="mx-3 mb-3 min-h-11 text-left text-sm" onClick={props.onResume}>Resume held bill ({props.held})</button> : null}
    </aside>
  )
}

function Numpad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'Del'].map((key) => (
        <button key={key} type="button" className="min-h-12 rounded-xl border border-line text-lg" onClick={() => onKey(key)}>{key}</button>
      ))}
    </div>
  )
}

function Receipt({ slip, paper, onPaper, onPrint, onNew }: { slip: Slip; paper: '80' | 'a4'; onPaper: (paper: '80' | 'a4') => void; onPrint: () => void; onNew: () => void }) {
  return (
    <article className={`shop-receipt bg-receipt text-receipt rounded-2xl p-5 ${paper === 'a4' ? 'receipt-a4 max-w-3xl' : 'receipt-80 max-w-sm'}`}>
      {slip.duplicate ? <p className="text-center text-xs tracking-[0.16em] uppercase">Duplicate</p> : null}
      <p className="text-center font-serif text-2xl">GoldFlow</p>
      <p className="text-center text-xs tracking-[0.16em] uppercase">Ward Place showroom</p>
      <p className="mt-3 text-center text-xs">{slip.invoices.join(' · ') || 'Invoice'} · {slip.at}</p>
      <p className="mt-3 text-sm">{slip.customer}{slip.phone ? ` · ${slip.phone}` : ''}</p>
      <p className="text-receipt-soft text-xs">Served by {slip.cashier}</p>
      <ul className="border-receipt mt-3 border-t pt-2 text-sm">
        {slip.lines.map((line) => (
          <li key={line.tag} className="py-1">
            <span className="flex justify-between gap-3"><span>{line.name}</span><span className="tabular-nums">{money(line.total)}</span></span>
            <span className="text-receipt-soft block text-xs">{line.tag} · {line.purity} · {line.grams} g</span>
            <span className="text-receipt-soft block text-xs">Rate {money(line.rate)} / g · {line.rateLabel} · {line.rateSource}</span>
            <span className="text-receipt-soft block text-xs">{line.rateAt}</span>
          </li>
        ))}
      </ul>
      <div className="border-receipt mt-2 grid gap-1 border-t pt-2 text-sm">
        <p className="flex justify-between"><span>Discount</span><span className="tabular-nums">{money(slip.discount)}</span></p>
        <p className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(slip.tax)}</span></p>
        {slip.credit > 0 ? <p className="flex justify-between"><span>Old-gold credit</span><span className="tabular-nums">{money(slip.credit)}</span></p> : null}
        <p className="flex justify-between font-serif text-lg"><span>Total</span><span className="tabular-nums">{money(slip.total)}</span></p>
        <p className="flex justify-between"><span>{slip.method}</span><span className="tabular-nums">{money(slip.tender)}</span></p>
        {slip.last4 ? <p className="flex justify-between"><span>Card</span><span>···· {slip.last4}</span></p> : null}
        {slip.approval ? <p className="flex justify-between"><span>Approval</span><span>{slip.approval}</span></p> : null}
        {slip.reference ? <p className="flex justify-between"><span>Reference</span><span>{slip.reference}</span></p> : null}
        <p className="flex justify-between"><span>Change</span><span className="tabular-nums">{money(slip.change)}</span></p>
        {slip.balance > 0 ? <p className="flex justify-between"><span>Still owed</span><span className="tabular-nums">{money(slip.balance)}</span></p> : null}
      </div>
      <p className="mt-4 text-center text-xs">Please keep this receipt. An exchange needs this bill.</p>
      <div className="mt-4 grid gap-2 print:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`min-h-11 rounded-xl border ${paper === '80' ? 'bg-receipt-ink' : 'border-receipt'}`} onClick={() => onPaper('80')}>80 mm</button>
          <button type="button" className={`min-h-11 rounded-xl border ${paper === 'a4' ? 'bg-receipt-ink' : 'border-receipt'}`} onClick={() => onPaper('a4')}>A4</button>
        </div>
        <button type="button" className="bg-receipt-ink min-h-11 rounded-xl" onClick={onPrint}>Print</button>
        <button type="button" className="border-receipt min-h-11 rounded-xl border" onClick={onPrint}>Download PDF</button>
        <button type="button" className="border-receipt min-h-11 rounded-xl border" onClick={onNew}>New sale</button>
      </div>
    </article>
  )
}

function Gem() {
  return (
    <span className="grid h-40 place-items-center bg-[var(--mix-champagne)] text-[var(--gold-text)]">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M12 3 20 9l-8 12L4 9z" />
        <path d="M4 9h16M8 9l4 12 4-12" />
      </svg>
    </span>
  )
}

function methodLabel(method: PayMethod) {
  if (method === 'bank_transfer') return 'Bank transfer'
  if (method === 'credit') return 'Credit'
  if (method === 'split') return 'Split'
  return method[0]?.toUpperCase() + method.slice(1)
}

function payReason(method: PayMethod, tender: number | null, owing: number, splitTotal: number, splitInvalid: boolean, last4: string) {
  if (method === 'split') {
    if (splitInvalid) return 'Enter each split amount as a number.'
    if (splitTotal !== owing) return `Remaining ${money(Math.abs(owing - splitTotal))}. The split has to match the total.`
    return null
  }
  if (tender === null) return 'Enter the amount received.'
  if (method === 'credit') {
    if (tender <= 0) return 'Enter a payment above zero. This desk does not store a bill with nothing received.'
    if (tender > owing) return 'That is more than the amount owed.'
    return null
  }
  if (method === 'card' && last4 && !/^\d{4}$/.test(last4)) return 'Use the last 4 digits only, or leave the field blank.'
  if (method === 'cash') {
    if (tender < owing) return `Still due ${money(owing - tender)}. Cash has to cover the bill.`
    return null
  }
  if (tender !== owing) return 'That amount has to match the total.'
  return null
}

function roundUp(cents: number, stepRupees: number) {
  const step = stepRupees * 100
  return Math.ceil(cents / step) * step
}

function readRupees(value: string) {
  if (!value.trim()) return 0
  try {
    return rupees(value)
  } catch {
    return null
  }
}

function slipLine(item: DeskItem, price: NonNullable<ReturnType<typeof safeBreakdown>>): SlipLine {
  return {
    name: item.name,
    tag: item.tag,
    purity: item.purity,
    grams: item.netGrams,
    total: price.totalCents,
    discount: price.discountCents,
    metal: price.metalValueCents,
    making: price.makingChargeCents,
    wastage: price.wastageChargeCents,
    stones: price.stoneValueCents,
    tax: price.taxCents,
    subtotal: price.subtotalCents,
    rate: price.rate.rateCentsPerGram,
    rateSource: price.rate.source,
    rateAt: new Date(price.rate.effectiveAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }),
    rateLabel: 'Snapshot',
  }
}

function matchTag(items: DeskItem[], raw: string) {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
  if (code.length < 4) return null
  return items.find((item) => item.tag.toUpperCase() === code)
    ?? items.find((item) => code.endsWith(item.tag.toUpperCase()))
    ?? items.find((item) => code === item.tag.replace(/^TAG-/, ''))
    ?? null
}

function withDiscount(shop: Shop, tag: string, cents: number): Shop {
  return { ...shop, items: shop.items.map((item) => (item.tag === tag ? { ...item, discountCents: cents } : item)) }
}

function safeBreakdown(desk: Shop, tag: string) {
  try {
    return quoteBreakdown(desk, tag)
  } catch {
    return null
  }
}

function linePrice(desk: Shop, item: DeskItem, typed: string | undefined) {
  const auto = safeBreakdown(desk, item.tag)
  if (!typed?.trim()) return { price: auto, manual: false, blocked: false }
  try {
    const cents = rupees(typed)
    const price = safeBreakdown(withDiscount(desk, item.tag, cents), item.tag)
    if (!price) return { price: auto, manual: false, blocked: true }
    return { price, manual: true, blocked: false }
  } catch {
    return { price: auto, manual: false, blocked: false }
  }
}
