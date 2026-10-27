import { useState } from 'react'
import Decimal from 'decimal.js'
import {
  can,
  capabilities,
  centsToLkrString,
  formatDisplayStamp,
  lkrToCents,
  roles,
  type Capability,
  type Cents,
  type Role,
} from '@goldflow/shared'
import {
  addCustomer,
  addProduct,
  createAccount,
  roleWork,
  setAccountOptions,
  type DeskAccount,
  permits,
  approveAdjustment,
  approveRate,
  closeCash,
  closeRepair,
  closeWorkOrder,
  confirmPurchase,
  dispatchTransfer,
  draftPurchase,
  enterRate,
  intakeOldGold,
  openManufacturing,
  openRepair,
  repairPace,
  paySupplier,
  postJournal,
  profitFor,
  proposeAdjustment,
  receiveTransfer,
  recordExpense,
  returnInvoice,
  salesCsv,
  settleCredit,
  takeRepairAdvance,
  type Shop,
} from './desk.ts'
import type { LiveBoard } from './liveGold.ts'
import { optionLabel } from './access.ts'
import { Badge, Btn, BtnQuiet, DataTable, Field, Kpi, Panel, Screen, Td, inputClass, money, rupees } from './ui.tsx'

export type Run = (action: (current: Shop) => Shop) => void

function approvedSelling(desk: Shop) {
  return [...desk.rates].reverse().find((rate) => rate.status === 'approved' && rate.rateType === 'shop_selling' && rate.purity === '22K')
}

function tone(status: string): 'ok' | 'wait' | 'bad' | 'neutral' {
  if (status === 'approved' || status === 'completed' || status === 'confirmed' || status === 'received' || status === 'available' || status === 'closed') return 'ok'
  if (status === 'pending_approval' || status === 'draft' || status === 'credit' || status === 'open' || status === 'dispatched') return 'wait'
  if (status === 'returned' || status === 'cancelled' || status === 'sold') return 'bad'
  return 'neutral'
}

export { Dashboard } from './dashboard.tsx'

export function Rates({
  desk,
  run,
  board,
  problem,
}: {
  desk: Shop
  run: Run
  board: LiveBoard | null
  problem: string | null
}) {
  const live22 = board?.quotes.find((quote) => quote.purity === '22K')
  const canEdit = can(desk.role, 'editGoldRates')
  return (
    <Screen title="Gold rates" note="The board refreshes on its own. A filed quote waits for approval before the till uses it.">
      {problem ? <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{problem}</p> : null}
      <div className="grid gap-2 md:grid-cols-3">
        {(board?.quotes ?? []).map((quote) => (
          <Kpi key={quote.purity} label={`${quote.purity} per gram`} value={money(quote.cents)} />
        ))}
      </div>
      {canEdit ? (
        <Panel title="File a rate" className="flex flex-wrap items-end gap-2">
          {live22 ? <Btn onClick={() => run((current) => enterRate(current, live22.cents, board?.source ?? 'Live board', '22K', 'shop_selling'))}>File 22K selling</Btn> : null}
          {board?.quotes.map((quote) => (
            <BtnQuiet key={quote.purity} onClick={() => run((current) => enterRate(current, quote.cents, board.source, quote.purity, 'market_reference'))}>File {quote.purity} reference</BtnQuiet>
          ))}
        </Panel>
      ) : null}
      <DataTable title="Rate history" columns={['Purity', 'Type', 'LKR / g', 'Status', 'Source', 'Effective', '']}>
        {[...desk.rates].reverse().map((rate) => (
          <tr key={rate.id}>
            <Td>{rate.purity}</Td>
            <Td>{rate.rateType.replaceAll('_', ' ')}</Td>
            <Td className="tabular-nums">{money(rate.cents)}</Td>
            <Td><Badge tone={tone(rate.status)}>{rate.status.replaceAll('_', ' ')}</Badge></Td>
            <Td>{rate.source}</Td>
            <Td>{formatDisplayStamp(rate.effectiveAt)}</Td>
            <Td>
              {rate.status === 'pending_approval' && can(desk.role, 'approveGoldRates') ? (
                <Btn onClick={() => run((current) => approveRate(current, rate.id))}>Approve</Btn>
              ) : null}
            </Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

const pieceCategories = ['Rings', 'Necklaces', 'Earrings', 'Pendants', 'Bangles', 'Bracelets', 'Chains', 'Other']

export function Products({ desk, run }: { desk: Shop; run: Run }) {
  const available = desk.items.filter((item) => item.status === 'available')
  const cost = available.reduce((sum, item) => sum + item.costCents, 0)
  const canAdd = permits(desk, 'addProducts')
  const [tag, setTag] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Rings')
  const [purity, setPurity] = useState('22K')
  const [gross, setGross] = useState('')
  const [stone, setStone] = useState('0')
  const [net, setNet] = useState('')
  const [making, setMaking] = useState('')
  const [stones, setStones] = useState('')
  const [discount, setDiscount] = useState('0')
  const [pieceCost, setPieceCost] = useState('')
  return (
    <Screen title="Jewellery master" note="The admin adds each tag and sets the making charge, the stone charge and the discount. The till uses those figures.">
      {canAdd ? (
        <Panel title="Add a piece" className="grid gap-2 md:grid-cols-4">
          <Field label="Tag"><input className={inputClass} value={tag} onChange={(event) => setTag(event.target.value)} placeholder="TAG-0005" /></Field>
          <Field label="Name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Category">
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {pieceCategories.map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </Field>
          <Field label="Purity">
            <select className={inputClass} value={purity} onChange={(event) => setPurity(event.target.value)}>
              {['24K', '22K', '18K'].map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </Field>
          <Field label="Gross g"><input className={inputClass} inputMode="decimal" value={gross} onChange={(event) => setGross(event.target.value)} /></Field>
          <Field label="Stone g"><input className={inputClass} inputMode="decimal" value={stone} onChange={(event) => setStone(event.target.value)} /></Field>
          <Field label="Net g"><input className={inputClass} inputMode="decimal" value={net} onChange={(event) => setNet(event.target.value)} /></Field>
          <Field label="Making LKR"><input className={inputClass} inputMode="decimal" value={making} onChange={(event) => setMaking(event.target.value)} /></Field>
          <Field label="Stones LKR"><input className={inputClass} inputMode="decimal" value={stones} onChange={(event) => setStones(event.target.value)} /></Field>
          <Field label="Discount LKR"><input className={inputClass} inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} /></Field>
          <Field label="Tag cost LKR"><input className={inputClass} inputMode="decimal" value={pieceCost} onChange={(event) => setPieceCost(event.target.value)} /></Field>
          <div className="self-end">
            <Btn onClick={() => {
              const netGrams = net.trim() || (Number(gross) - Number(stone || '0')).toFixed(3)
              run((current) => addProduct(current, {
                tag,
                name,
                category,
                purity,
                grossGrams: gross,
                stoneGrams: stone || '0',
                netGrams,
                makingCents: rupees(making || '0'),
                stoneValueCents: rupees(stones || '0'),
                discountCents: rupees(discount || '0'),
                costCents: rupees(pieceCost),
              }))
              setTag('')
              setName('')
            }}>Add piece</Btn>
          </div>
        </Panel>
      ) : <p className="text-sm text-muted">This account can read the tags. Adding a piece is an admin option.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tagged pieces" value={String(desk.items.length)} />
        <Kpi label="Available" value={String(available.length)} />
        <Kpi label="Sold" value={String(desk.items.length - available.length)} />
        <Kpi label="Available at cost" value={money(cost)} />
      </div>
      <DataTable title="Showroom tags" columns={['Tag', 'Piece', 'Category', 'Purity', 'Net g', 'Making', 'Stones', 'Discount', 'Status', 'Cost']}>
        {desk.items.map((item) => (
          <tr key={item.tag}>
            <Td className="font-medium">{item.tag}</Td>
            <Td>{item.name}</Td>
            <Td>{item.category}</Td>
            <Td>{item.purity}</Td>
            <Td className="tabular-nums">{item.netGrams}</Td>
            <Td className="tabular-nums">{money(item.makingCents)}</Td>
            <Td className="tabular-nums">{money(item.stoneValueCents)}</Td>
            <Td className="tabular-nums">{money(item.discountCents)}</Td>
            <Td><Badge tone={tone(item.status)}>{item.status}</Badge></Td>
            <Td className="tabular-nums">{money(item.costCents)}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Inventory({ desk, run }: { desk: Shop; run: Run }) {
  const [tag, setTag] = useState(desk.items[0]?.tag ?? '')
  const [after, setAfter] = useState<'available' | 'sold'>('sold')
  const [reason, setReason] = useState('Count difference')
  const [destination, setDestination] = useState('vault')
  return (
    <Screen title="Stock" note="A count difference stays pending until another role approves it. Transfers record dispatch and receipt separately.">
      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="Count adjustment" className="grid gap-2 md:grid-cols-2">
          <Field label="Tag"><TagSelect desk={desk} value={tag} onChange={setTag} /></Field>
          <Field label="Counted as">
            <select className={inputClass} value={after} onChange={(event) => setAfter(event.target.value as 'available' | 'sold')}>
              <option value="available">available</option>
              <option value="sold">sold</option>
            </select>
          </Field>
          <Field label="Reason"><input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          <div className="self-end"><Btn onClick={() => run((current) => proposeAdjustment(current, tag, after, reason))}>Propose adjustment</Btn></div>
        </Panel>
        <Panel title="Send to another branch" className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Tag"><TagSelect desk={desk} value={tag} onChange={setTag} /></Field>
          <Field label="Destination"><input className={inputClass} value={destination} onChange={(event) => setDestination(event.target.value)} /></Field>
          <Btn onClick={() => run((current) => dispatchTransfer(current, tag, destination))}>Dispatch</Btn>
        </Panel>
      </div>
      <DataTable title="Counts and transfers" columns={['Document', 'Tag', 'Detail', 'Action']}>
        {desk.adjustments.map((entry) => (
          <tr key={entry.id}>
            <Td>{entry.id}</Td>
            <Td>{entry.tag}</Td>
            <Td>{entry.before} → {entry.after} · {entry.reason} · {entry.approved ? 'approved' : 'pending'}</Td>
            <Td>{!entry.approved && can(desk.role, 'approveStockAdjust') ? <Btn onClick={() => run((current) => approveAdjustment(current, entry.id))}>Approve</Btn> : null}</Td>
          </tr>
        ))}
        {desk.transfers.map((transfer) => (
          <tr key={transfer.id}>
            <Td>{transfer.id}</Td>
            <Td>{transfer.tag}</Td>
            <Td>{transfer.from} → {transfer.to} · {transfer.status}</Td>
            <Td>{transfer.status === 'dispatched' ? <Btn onClick={() => run((current) => receiveTransfer(current, transfer.id))}>Receive</Btn> : null}</Td>
          </tr>
        ))}
      </DataTable>
      <DataTable title="Stock movements" columns={['Reference', 'Tag', 'Movement']}>
        {desk.movements.map((movement, index) => (
          <tr key={`${movement.ref}-${index}`}>
            <Td>{movement.ref}</Td>
            <Td>{movement.tag}</Td>
            <Td>{movement.reason.replaceAll('_', ' ')}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

function TagSelect({ desk, value, onChange }: { desk: Shop; value: string; onChange: (value: string) => void }) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {desk.items.map((item) => (
        <option key={item.tag} value={item.tag}>{item.tag} · {item.name}</option>
      ))}
    </select>
  )
}

export function Purchases({ desk, run }: { desk: Shop; run: Run }) {
  const [tag, setTag] = useState('TAG-0100')
  const [name, setName] = useState('New bangle')
  const [cost, setCost] = useState('180000')
  const [grams, setGrams] = useState('8')
  const [pay, setPay] = useState('')
  return (
    <Screen title="Purchases" note="A draft does not enter stock. Confirming the receipt creates the tag and the amount payable to the supplier.">
      {permits(desk, 'managePurchases') ? <Panel title="New purchase draft" className="grid gap-2 md:grid-cols-5 md:items-end">
        <Field label="Tag"><input className={inputClass} value={tag} onChange={(event) => setTag(event.target.value)} /></Field>
        <Field label="Name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Gross grams"><input className={inputClass} inputMode="decimal" value={grams} onChange={(event) => setGrams(event.target.value)} /></Field>
        <Field label="Cost LKR"><input className={inputClass} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>
        <Btn onClick={() => run((current) => draftPurchase(current, { tag, supplierId: 'S1', costCents: rupees(cost), name, grossGrams: grams, netGrams: grams }))}>Save draft</Btn>
      </Panel> : <p className="text-sm text-muted">This role can read purchases. Drafting a new order stays closed until an admin approves it.</p>}
      <DataTable title="Purchase orders" columns={['Purchase', 'Tag', 'Piece', 'Cost', 'Status', '']}>
        {desk.purchases.map((purchase) => (
          <tr key={purchase.id}>
            <Td>{purchase.id}</Td>
            <Td>{purchase.tag}</Td>
            <Td>{purchase.name} · {purchase.purity} · {purchase.grossGrams} g</Td>
            <Td className="tabular-nums">{money(purchase.costCents)}</Td>
            <Td><Badge tone={tone(purchase.status)}>{purchase.status}</Badge></Td>
            <Td>{purchase.status === 'draft' && can(desk.role, 'receiveStock') ? <Btn onClick={() => run((current) => confirmPurchase(current, purchase.id))}>Confirm receipt</Btn> : null}</Td>
          </tr>
        ))}
      </DataTable>
      <DataTable title="Supplier balances" columns={['Supplier', 'Payable', 'Pay']}>
        {desk.suppliers.map((supplier) => (
          <tr key={supplier.id}>
            <Td>{supplier.name}</Td>
            <Td className="tabular-nums">{money(supplier.balanceCents)}</Td>
            <Td>
              {permits(desk, 'managePurchases') || permits(desk, 'viewProfit') ? (
                <span className="flex gap-2">
                  <input className={`${inputClass} w-32`} inputMode="decimal" value={pay} placeholder="LKR" onChange={(event) => setPay(event.target.value)} aria-label={`Payment to ${supplier.name}`} />
                  <Btn disabled={supplier.balanceCents <= 0} onClick={() => run((current) => paySupplier(current, supplier.id, rupees(pay)))}>Pay</Btn>
                </span>
              ) : <span className="text-xs text-muted">Closed until an admin approves payment</span>}
            </Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Customers({ desk, run }: { desk: Shop; run: Run }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <Screen title="Customers" note="Contact, old-gold credit and the balance still owed on credit invoices.">
      <Panel title="New customer" className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Phone"><input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Btn onClick={() => { run((current) => addCustomer(current, name, phone)); setName(''); setPhone('') }}>Add</Btn>
      </Panel>
      <DataTable title="Customer book" columns={['Customer', 'Phone', 'Invoices', 'Old-gold credit', 'Amount owed']}>
        {desk.customers.map((customer) => {
          const invoices = desk.invoices.filter((invoice) => invoice.customerId === customer.id)
          const due = invoices.filter((invoice) => invoice.status === 'credit').reduce((sum, invoice) => sum + invoice.totalCents - invoice.paidCents, 0)
          return (
            <tr key={customer.id}>
              <Td>{customer.name}</Td>
              <Td>{customer.phone || '—'}</Td>
              <Td>{invoices.length}</Td>
              <Td className="tabular-nums">{money(customer.oldGoldCents)}</Td>
              <Td className="tabular-nums">{money(due)}</Td>
            </tr>
          )
        })}
      </DataTable>
    </Screen>
  )
}

export function OldGold({ desk, run }: { desk: Shop; run: Run }) {
  const [customerId, setCustomerId] = useState(desk.customers[0]?.id ?? 'C1')
  const [grams, setGrams] = useState('5')
  const [purity, setPurity] = useState('22K')
  const [rate, setRate] = useState('')
  const [deduction, setDeduction] = useState('0')
  const selling = approvedSelling(desk)
  const rateText = rate || (selling ? centsToLkrString(selling.cents) : '')
  let assessed: Cents | null = null
  try {
    const value = new Decimal(grams || '0').mul(rateText || '0').minus(deduction || '0')
    assessed = value.gt(0) ? lkrToCents(value.toFixed(2)) : null
  } catch {
    assessed = null
  }
  return (
    <Screen title="Old gold" note="The assessed line is stored on its own. The credit is applied once, on the next invoice, and it is not treated as a cash receipt.">
      <Panel title="Assess a piece" className="grid gap-2 md:grid-cols-3">
        <Field label="Customer">
          <select className={inputClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {desk.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </Field>
        <Field label="Purity">
          <select className={inputClass} value={purity} onChange={(event) => setPurity(event.target.value)}>
            {['24K', '22K', '18K'].map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </Field>
        <Field label="Grams"><input className={inputClass} inputMode="decimal" value={grams} onChange={(event) => setGrams(event.target.value)} /></Field>
        <Field label="Buying rate LKR / g"><input className={inputClass} inputMode="decimal" value={rateText} onChange={(event) => setRate(event.target.value)} /></Field>
        <Field label="Deduction LKR"><input className={inputClass} inputMode="decimal" value={deduction} onChange={(event) => setDeduction(event.target.value)} /></Field>
        <div className="self-end">
          <p className="text-lg font-semibold tabular-nums">{assessed ? money(assessed) : '—'}</p>
          <Btn className="mt-2" disabled={!assessed} onClick={() => assessed && run((current) => intakeOldGold(current, customerId, assessed, { purity, grams }))}>Record intake</Btn>
        </div>
      </Panel>
      <DataTable title="Intakes" columns={['Line', 'Customer', 'Weight', 'Purity', 'Credit']}>
        {desk.oldGold.map((entry) => (
          <tr key={entry.id}>
            <Td>{entry.id}</Td>
            <Td>{desk.customers.find((customer) => customer.id === entry.customerId)?.name}</Td>
            <Td>{entry.grams} g</Td>
            <Td>{entry.purity}</Td>
            <Td className="tabular-nums">{money(entry.cents)}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Repairs({ desk, run }: { desk: Shop; run: Run }) {
  const [customerId, setCustomerId] = useState(desk.customers[0]?.id ?? 'C1')
  const [itemLabel, setItemLabel] = useState('Chain clasp')
  const [estimate, setEstimate] = useState('8000')
  const [advance, setAdvance] = useState('3000')
  const [dueOn, setDueOn] = useState(() => {
    const received = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const [year, month, day] = received.split('-').map(Number)
    return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + 7)).toISOString().slice(0, 10)
  })
  const receivedOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return (
    <Screen title="Repairs" note="The receive date is today. Set the delivery date, and the job shows how close that date is.">
      <Panel title="New job card" className="grid gap-2 md:grid-cols-3 lg:grid-cols-6 md:items-end">
        <Field label="Customer">
          <select className={inputClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {desk.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </Field>
        <Field label="Item"><input className={inputClass} value={itemLabel} onChange={(event) => setItemLabel(event.target.value)} /></Field>
        <Field label="Received"><input className={inputClass} value={receivedOn} readOnly aria-label="Received date" /></Field>
        <Field label="Delivery date"><input className={inputClass} type="date" value={dueOn} min={receivedOn} onChange={(event) => setDueOn(event.target.value)} /></Field>
        <Field label="Estimate LKR"><input className={inputClass} inputMode="decimal" value={estimate} onChange={(event) => setEstimate(event.target.value)} /></Field>
        <Btn onClick={() => run((current) => openRepair(current, rupees(estimate), customerId, itemLabel, dueOn))}>Open job</Btn>
      </Panel>
      <DataTable title="Open and closed jobs" columns={['Job', 'Customer', 'Item', 'Received', 'Delivery', 'Progress', 'Estimate', 'Balance', '']}>
        {desk.repairs.map((job) => {
          const pace = repairPace(job)
          return (
            <tr key={job.id}>
              <Td>{job.id}</Td>
              <Td>{desk.customers.find((customer) => customer.id === job.customerId)?.name}</Td>
              <Td>{job.itemLabel}</Td>
              <Td>{job.receivedOn}</Td>
              <Td>{job.dueOn}</Td>
              <Td>
                <span className="block text-xs">{pace.label}</span>
                <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-ink/10">
                  <span className={`block h-full rounded-full ${pace.tone === 'bad' ? 'bg-rose-300' : pace.tone === 'wait' ? 'bg-amber-200' : 'bg-gold'}`} style={{ width: `${pace.percent}%` }} />
                </span>
              </Td>
              <Td className="tabular-nums">{money(job.estimateCents)}</Td>
              <Td className="tabular-nums">{money(Math.max(0, job.estimateCents - job.advanceCents))}</Td>
              <Td>
                {job.status === 'open' ? (
                  <span className="flex gap-2">
                    <input className={`${inputClass} w-28`} inputMode="decimal" value={advance} aria-label={`Advance for ${job.id}`} onChange={(event) => setAdvance(event.target.value)} />
                    <BtnQuiet onClick={() => run((current) => takeRepairAdvance(current, job.id, rupees(advance)))}>Advance</BtnQuiet>
                    <Btn onClick={() => run((current) => closeRepair(current, job.id))}>Collected</Btn>
                  </span>
                ) : <Badge tone="ok">Collected</Badge>}
              </Td>
            </tr>
          )
        })}
      </DataTable>
    </Screen>
  )
}

export function Manufacturing({ desk, run }: { desk: Shop; run: Run }) {
  const [issued, setIssued] = useState('8.5')
  const [labour, setLabour] = useState('4000')
  const [returned, setReturned] = useState('0.4')
  return (
    <Screen title="Workshop" note="A work order records gold issued to the maker, gold returned, and the labour charge. Closing it keeps the wastage figure on the order.">
      <Panel title="New work order" className="flex flex-wrap items-end gap-2">
        <div className="w-32"><Field label="Issued grams"><input className={inputClass} value={issued} onChange={(event) => setIssued(event.target.value)} /></Field></div>
        <div className="w-36"><Field label="Labour LKR"><input className={inputClass} inputMode="decimal" value={labour} onChange={(event) => setLabour(event.target.value)} /></Field></div>
        <Btn onClick={() => run((current) => openManufacturing(current, issued, rupees(labour)))}>Open work order</Btn>
      </Panel>
      <DataTable title="Karigar orders" columns={['Order', 'Issued g', 'Returned g', 'Labour', 'Status', '']}>
        {desk.workOrders.map((job) => (
          <tr key={job.id}>
            <Td>{job.id}</Td>
            <Td>{job.issuedGrams}</Td>
            <Td>{job.returnedGrams}</Td>
            <Td className="tabular-nums">{money(job.labourCents)}</Td>
            <Td><Badge tone={tone(job.status)}>{job.status}</Badge></Td>
            <Td>
              {job.status === 'open' ? (
                <span className="flex gap-2">
                  <input className={`${inputClass} w-24`} value={returned} aria-label={`Returned grams for ${job.id}`} onChange={(event) => setReturned(event.target.value)} />
                  <Btn onClick={() => run((current) => closeWorkOrder(current, job.id, returned))}>Close</Btn>
                </span>
              ) : null}
            </Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Payments({ desk, run }: { desk: Shop; run: Run }) {
  const cashExpected = desk.invoices.filter((invoice) => invoice.status === 'completed').flatMap((invoice) => invoice.payments).filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + payment.cents, 0)
  const card = desk.invoices.filter((invoice) => invoice.status === 'completed').flatMap((invoice) => invoice.payments).filter((payment) => payment.method === 'card').reduce((sum, payment) => sum + payment.cents, 0)
  const bank = desk.invoices.filter((invoice) => invoice.status === 'completed').flatMap((invoice) => invoice.payments).filter((payment) => payment.method === 'bank_transfer').reduce((sum, payment) => sum + payment.cents, 0)
  const [counted, setCounted] = useState('')
  const [settle, setSettle] = useState<Record<string, string>>({})
  return (
    <Screen title="Cash and bank" note="The drawer is compared with cash on completed invoices. Card and bank are listed apart. A credit sale is not cash.">
      <div className="grid gap-2 md:grid-cols-3">
        <Kpi label="Cash on completed invoices" value={money(cashExpected)} />
        <Kpi label="Card" value={money(card)} />
        <Kpi label="Bank" value={money(bank)} />
      </div>
      <Panel title="Close the drawer" className="flex flex-wrap items-end gap-2">
        <div className="w-48"><Field label="Cash counted"><input className={inputClass} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} /></Field></div>
        <Btn onClick={() => run((current) => closeCash(current, rupees(counted)))}>Close the day</Btn>
        {desk.cashClose ? <p className="text-sm">Drawer {money(desk.cashClose.invoicesCents)} · counted {money(desk.cashClose.countedCents)} · difference {money(desk.cashClose.countedCents - desk.cashClose.invoicesCents)}</p> : null}
      </Panel>
      <DataTable title="Invoices" columns={['Invoice', 'Status', 'Total', 'Paid', 'Due', 'Settle']}>
        {desk.invoices.map((invoice) => {
          const due = invoice.totalCents - invoice.paidCents
          return (
            <tr key={invoice.id}>
              <Td>{invoice.id} · {invoice.tag}</Td>
              <Td><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></Td>
              <Td className="tabular-nums">{money(invoice.totalCents)}</Td>
              <Td className="tabular-nums">{money(invoice.paidCents)}</Td>
              <Td className="tabular-nums">{money(Math.max(0, due))}</Td>
              <Td>
                {invoice.status === 'credit' ? (
                  <span className="flex gap-2">
                    <input className={`${inputClass} w-32`} inputMode="decimal" value={settle[invoice.id] ?? ''} aria-label={`Settlement for ${invoice.id}`} onChange={(event) => setSettle((current) => ({ ...current, [invoice.id]: event.target.value }))} />
                    <Btn onClick={() => run((current) => settleCredit(current, invoice.id, [{ method: 'cash', cents: rupees(settle[invoice.id] ?? '') }]))}>Take payment</Btn>
                  </span>
                ) : null}
              </Td>
            </tr>
          )
        })}
      </DataTable>
    </Screen>
  )
}

export function Accounting({ desk, run }: { desk: Shop; run: Run }) {
  const allowed = can(desk.role, 'viewProfit') || can(desk.role, 'viewLimitedProfit')
  const profit = allowed ? profitFor(desk) : null
  const [debit, setDebit] = useState('1000')
  const [credit, setCredit] = useState('1000')
  const [source, setSource] = useState('cash to bank')
  return (
    <Screen title="Ledgers" note="Net sales are invoice totals less returns. Cost of goods is the recorded cost of tags still sold. A rate change is not profit.">
      {profit ? (
        <div className="grid gap-2 md:grid-cols-4">
          <Kpi label="Net sales" value={money(profit.netSalesCents)} />
          <Kpi label="Cost of goods" value={money(profit.cogsCents)} />
          <Kpi label="Gross profit" value={money(profit.grossProfitCents)} />
          <Kpi label="Net profit" value={money(profit.netProfitCents)} />
        </div>
      ) : <p className="text-sm text-muted">This role cannot see profit.</p>}
      {can(desk.role, 'viewProfit') ? (
        <Panel title="Manual journal" className="grid gap-2 md:grid-cols-4 md:items-end">
          <Field label="Debit LKR"><input className={inputClass} inputMode="decimal" value={debit} onChange={(event) => setDebit(event.target.value)} /></Field>
          <Field label="Credit LKR"><input className={inputClass} inputMode="decimal" value={credit} onChange={(event) => setCredit(event.target.value)} /></Field>
          <Field label="Source"><input className={inputClass} value={source} onChange={(event) => setSource(event.target.value)} /></Field>
          <Btn onClick={() => run((current) => postJournal(current, rupees(debit), rupees(credit), source))}>Post journal</Btn>
        </Panel>
      ) : null}
      <DataTable title="Posted journals" columns={['Journal', 'Source', 'Debit', 'Credit']}>
        {desk.journals.map((journal) => (
          <tr key={journal.id}>
            <Td>{journal.id}</Td>
            <Td>{journal.source}</Td>
            <Td className="tabular-nums">{money(journal.debit)}</Td>
            <Td className="tabular-nums">{money(journal.credit)}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

const expenseCategories = ['rent', 'salaries', 'utilities', 'transport', 'repair']

export function Expenses({ desk, run }: { desk: Shop; run: Run }) {
  const [category, setCategory] = useState(expenseCategories[0] ?? 'rent')
  const [amount, setAmount] = useState('1000')
  return (
    <Screen title="Expenses" note="Rent, salaries, utilities, transport and repair costs reduce net profit.">
      <Panel title="Record an expense" className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field label="Category">
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {expenseCategories.map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </Field>
        </div>
        <div className="w-36"><Field label="Amount LKR"><input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div>
        <Btn onClick={() => run((current) => recordExpense(current, category, rupees(amount)))}>Record</Btn>
      </Panel>
      <DataTable title="Expense book" columns={['Entry', 'Category', 'Amount']}>
        {desk.expenses.map((expense) => (
          <tr key={expense.id}>
            <Td>{expense.id}</Td>
            <Td>{expense.category}</Td>
            <Td className="tabular-nums">{money(expense.cents)}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Returns({ desk, run }: { desk: Shop; run: Run }) {
  const [reason, setReason] = useState('Customer return')
  return (
    <Screen title="Returns" note="A return names the original invoice, records the reason, and puts the tag back in stock. The invoice stays on the books.">
      <DataTable title="Invoices" columns={['Invoice', 'Tag', 'Status', 'Total', 'Reason', '']}>
        {desk.invoices.map((invoice) => (
          <tr key={invoice.id}>
            <Td>{invoice.id}</Td>
            <Td>{invoice.tag}</Td>
            <Td><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></Td>
            <Td className="tabular-nums">{money(invoice.totalCents)}</Td>
            <Td>{invoice.returnReason || '—'}</Td>
            <Td>
              {invoice.status === 'completed' ? (
                <span className="flex gap-2">
                  <input className={`${inputClass} w-40`} value={reason} aria-label={`Reason for ${invoice.id}`} onChange={(event) => setReason(event.target.value)} />
                  <Btn onClick={() => { if (window.confirm(`Return ${invoice.id}? The original invoice stays on the books.`)) run((current) => returnInvoice(current, invoice.id, reason)) }}>Return</Btn>
                </span>
              ) : null}
            </Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Reports({ desk }: { desk: Shop }) {
  const allowed = can(desk.role, 'viewProfit') || can(desk.role, 'viewLimitedProfit')
  const profit = allowed ? profitFor(desk) : null
  function download() {
    const blob = new Blob([salesCsv(desk)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sujani-sales.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Screen title="Reports" note="Totals are taken from the invoices, stock movements, purchases and expenses already on the desk.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Invoices" value={String(desk.invoices.length)} />
        <Kpi label="Available tags" value={String(desk.items.filter((item) => item.status === 'available').length)} />
        <Kpi label="Old-gold lines" value={String(desk.oldGold.length)} />
        <Kpi label="Supplier payable" value={money(desk.suppliers.reduce((sum, supplier) => sum + supplier.balanceCents, 0))} />
      </div>
      {profit ? <p className="text-sm">Net sales {money(profit.netSalesCents)} · gross profit {money(profit.grossProfitCents)} · net profit {money(profit.netProfitCents)}</p> : <p className="text-sm text-muted">Profit is hidden for this role.</p>}
      <div><BtnQuiet onClick={download}>Download sales CSV</BtnQuiet></div>
      <DataTable title="Sales register" columns={['Invoice', 'Customer', 'Tag', 'Status', 'Total', 'Rate / g']}>
        {desk.invoices.map((invoice) => (
          <tr key={invoice.id}>
            <Td>{invoice.id}</Td>
            <Td>{desk.customers.find((customer) => customer.id === invoice.customerId)?.name}</Td>
            <Td>{invoice.tag}</Td>
            <Td><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></Td>
            <Td className="tabular-nums">{money(invoice.totalCents)}</Td>
            <Td className="tabular-nums">{money(invoice.rateCentsPerGram)}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export function Audit({ desk }: { desk: Shop }) {
  return (
    <Screen title="Audit" note="Each important action keeps the role and the time. Stock adjustments also keep the before and after values.">
      <DataTable title="Audit trail" columns={['Time', 'Role', 'Action']}>
        {[...desk.audit].reverse().map((entry, index) => (
          <tr key={`${entry.at}-${index}`}>
            <Td>{formatDisplayStamp(entry.at)}</Td>
            <Td>{entry.role}</Td>
            <Td>{entry.action.replaceAll('_', ' ')}</Td>
          </tr>
        ))}
      </DataTable>
    </Screen>
  )
}

export const staff: { email: string; role: Role }[] = [
  { email: 'owner@demo.goldflow.local', role: roles.owner },
  { email: 'manager@demo.goldflow.local', role: roles.manager },
  { email: 'cashier@demo.goldflow.local', role: roles.cashier },
  { email: 'accountant@demo.goldflow.local', role: roles.accountant },
  { email: 'store@demo.goldflow.local', role: roles.storekeeper },
]

const workOptions = (Object.values(capabilities) as Capability[]).filter((capability) => capability !== 'manageUsers' && capability !== 'manageSettings')

export function Users({ desk, run }: { desk: Shop; run: Run }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('cashier')
  const [picked, setPicked] = useState<Capability[]>(() => roleWork('cashier'))
  return (
    <Screen title="Staff access" note="Only the admin creates an account. Tick the work that account may open. The admin account keeps every option.">
      <Panel title="New account" className="grid gap-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Field label="Name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Email"><input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Password"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
          <Field label="Role">
            <select className={inputClass} value={role} onChange={(event) => {
              const next = event.target.value as Role
              setRole(next)
              setPicked(roleWork(next))
            }}>
              {(Object.values(roles) as Role[]).filter((entry) => entry !== 'owner').map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </Field>
        </div>
        <WorkChecks picked={picked} onChange={setPicked} />
        <div>
          <Btn onClick={() => {
            run((current) => createAccount(current, { name, email, password, role, options: picked }))
            setName('')
            setEmail('')
            setPassword('')
          }}>Create account</Btn>
        </div>
      </Panel>
      <DataTable title="Desk accounts" columns={['Name', 'Role', 'Email', 'Work', 'Signed in']}>
        {desk.accounts.map((person) => (
          <tr key={person.id}>
            <Td>{person.name}</Td>
            <Td className="capitalize">{person.role === 'owner' ? 'Admin' : person.role}</Td>
            <Td>{person.email}</Td>
            <Td>{person.role === 'owner' ? 'Every option' : person.options.map((option) => optionLabel[option]).join(', ') || 'None'}</Td>
            <Td>{person.id === desk.accountId ? <Badge tone="ok">current</Badge> : '—'}</Td>
          </tr>
        ))}
      </DataTable>
      {desk.accounts.filter((person) => person.role !== 'owner').map((person) => (
        <AccountWork key={person.id} account={person} run={run} />
      ))}
    </Screen>
  )
}

function WorkChecks({ picked, onChange }: { picked: Capability[]; onChange: (next: Capability[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {workOptions.map((capability) => {
        const on = picked.includes(capability)
        return (
          <label key={capability} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
            <input type="checkbox" checked={on} onChange={() => onChange(on ? picked.filter((entry) => entry !== capability) : [...picked, capability])} />
            {optionLabel[capability]}
          </label>
        )
      })}
    </div>
  )
}

function AccountWork({ account, run }: { account: DeskAccount; run: Run }) {
  const [picked, setPicked] = useState<Capability[]>(account.options)
  return (
    <Panel title={`${account.name} · ${account.role}`} className="grid gap-3">
      <WorkChecks picked={picked} onChange={setPicked} />
      <div><Btn onClick={() => run((current) => setAccountOptions(current, account.id, picked))}>Save work</Btn></div>
    </Panel>
  )
}
