import { describe, expect, it } from 'vitest'
import { lkrToCents } from '@goldflow/shared'
import {
  addProduct,
  approveAdjustment,
  approveRate,
  closeCash,
  closeRepair,
  confirmPurchase,
  createAccount,
  createShop,
  DeskError,
  dispatchTransfer,
  enterRate,
  grantAccess,
  intakeOldGold,
  invoiceTotal,
  openRepair,
  quoteItem,
  postJournal,
  profitFor,
  proposeAdjustment,
  receiveTransfer,
  returnInvoice,
  sell,
  takeRepairAdvance,
} from './desk.ts'

const pay = (cents: number) => [{ method: 'cash', cents }]

describe('erp desk', () => {
  it('denies a cashier editing a rate and keeps an audit row', () => {
    try {
      enterRate(createShop('cashier'), lkrToCents('40000'), 'Manual')
      expect.fail('expected denial')
    } catch (error) {
      expect(error).toBeInstanceOf(DeskError)
      expect((error as DeskError).shop.audit.at(-1)?.action).toBe('rate.denied')
    }
  })

  it('prices the seeded solitaire with the report formula', () => {
    const shop = createShop()
    expect(quoteItem(shop, 'TAG-0001')).toBe(invoiceTotal(shop))
  })

  it('keeps the old invoice rate when a new rate is approved', () => {
    const first = sell(createShop(), { tag: 'TAG-0001', payments: pay(lkrToCents('321871.76')), key: 'a', customerId: 'C1' })
    const drafted = enterRate(first, lkrToCents('40000'), 'Manual entry')
    const approved = approveRate(drafted, drafted.rates.at(-1)!.id)
    const second = sell(approved, { tag: 'TAG-0002', payments: pay(quoteItem(approved, 'TAG-0002')), key: 'b', customerId: 'C1' })
    expect(second.invoices[0]?.rateCentsPerGram).toBe(lkrToCents('39108.97'))
    expect(second.invoices[1]?.rateCentsPerGram).toBe(lkrToCents('40000'))
  })

  it('adds stock only when a purchase is confirmed', () => {
    const shop = createShop()
    expect(shop.items.some((item) => item.tag === 'TAG-0099')).toBe(false)
    const confirmed = confirmPurchase(shop, 'PO-1')
    expect(confirmed.items.some((item) => item.tag === 'TAG-0099')).toBe(true)
    expect(confirmed.suppliers[0]?.balanceCents).toBe(lkrToCents('200000'))
  })

  it('lets one sale succeed and blocks the second', () => {
    const sold = sell(createShop(), { tag: 'TAG-0001', payments: pay(lkrToCents('321871.76')), key: 'once', customerId: 'C1' })
    expect(() => sell(sold, { tag: 'TAG-0001', payments: pay(lkrToCents('321871.76')), key: 'again', customerId: 'C1' })).toThrow(/not available/)
    expect(sell(sold, { tag: 'TAG-0001', payments: pay(1), key: 'once', customerId: 'C1' }).invoices).toHaveLength(1)
  })

  it('accepts a split payment that settles the invoice', () => {
    const total = lkrToCents('321871.76')
    const sold = sell(createShop(), {
      tag: 'TAG-0001',
      payments: [
        { method: 'cash', cents: lkrToCents('200000') },
        { method: 'card', cents: total - lkrToCents('200000') },
      ],
      key: 'split',
      customerId: 'C1',
    })
    expect(sold.invoices[0]?.status).toBe('completed')
    expect(sold.invoices[0]?.payments.reduce((sum, payment) => sum + payment.cents, 0)).toBe(total)
  })

  it('returns stock only against the original invoice', () => {
    const sold = sell(createShop(), { tag: 'TAG-0001', payments: pay(lkrToCents('321871.76')), key: 'r', customerId: 'C1' })
    const returned = returnInvoice(sold, sold.invoices[0]!.id)
    expect(returned.items[0]?.status).toBe('available')
    expect(() => returnInvoice(createShop(), 'missing')).toThrow(/original/)
  })

  it('closes a repair after an advance', () => {
    const opened = openRepair(createShop(), lkrToCents('8000'))
    const advanced = takeRepairAdvance(opened, 'R-1', lkrToCents('3000'))
    const closed = closeRepair(advanced, 'R-1')
    expect(closed.repairs[0]?.status).toBe('closed')
    expect(closed.repairs[0]?.advanceCents).toBe(lkrToCents('3000'))
  })

  it('keeps before and after on an approved stock adjustment', () => {
    const proposed = proposeAdjustment(createShop(), 'TAG-0001', 'sold', 'Count difference')
    const approved = approveAdjustment(proposed, 'ADJ-1')
    expect(approved.adjustments[0]).toMatchObject({ before: 'available', after: 'sold', approved: true })
    expect(approved.items[0]?.status).toBe('sold')
  })

  it('rejects an unbalanced journal and moves a tag between branches', () => {
    expect(() => postJournal(createShop(), 10, 11, 'test')).toThrow(/balance/)
    const sent = dispatchTransfer(createShop(), 'TAG-0001', 'vault')
    const received = receiveTransfer(sent, 'TR-1')
    expect(received.items[0]?.branch).toBe('vault')
  })

  it('applies old-gold credit on the invoice and clears the customer balance', () => {
    const total = invoiceTotal(createShop())
    const credited = intakeOldGold(createShop(), 'C1', lkrToCents('1000'))
    const sold = sell(credited, {
      tag: 'TAG-0001',
      payments: pay(total - lkrToCents('1000')),
      key: 'og',
      customerId: 'C1',
    })
    expect(sold.invoices[0]?.status).toBe('completed')
    expect(sold.invoices[0]?.payments.some((payment) => payment.method === 'old_gold_credit')).toBe(true)
    expect(sold.customers[0]?.oldGoldCents).toBe(0)
  })

  it('reconciles cash close with completed invoices', () => {
    const sold = sell(createShop(), { tag: 'TAG-0001', payments: pay(lkrToCents('321871.76')), key: 'cash', customerId: 'C1' })
    const closed = closeCash(sold, lkrToCents('321871.76'))
    expect(closed.cashClose?.invoicesCents).toBe(closed.cashClose?.countedCents)
    expect(profitFor(sold).netSalesCents).toBe(lkrToCents('321871.76'))
  })

  it('adds a tag only for an account allowed to, with the charges entered on the form', () => {
    const input = {
      tag: 'TAG-0005',
      name: 'Trial Bangle',
      category: 'Bangles',
      purity: '22K',
      grossGrams: '4.2',
      stoneGrams: '0.2',
      netGrams: '4.000',
      makingCents: lkrToCents('4500'),
      stoneValueCents: lkrToCents('800'),
      discountCents: lkrToCents('250'),
      costCents: lkrToCents('90000'),
    }
    expect(() => addProduct(createShop('cashier'), input)).toThrow(DeskError)
    const added = addProduct(createShop('owner'), input)
    expect(added.items.at(-1)).toMatchObject({ tag: 'TAG-0005', makingCents: lkrToCents('4500'), stoneValueCents: lkrToCents('800'), discountCents: lkrToCents('250') })
    const manager = createShop('manager')
    const allowed = { ...manager, accountId: 'A2', accounts: manager.accounts.map((account) => account.id === 'A2' ? { ...account, options: [...account.options, 'addProducts' as const] } : account) }
    expect(addProduct(allowed, { ...input, tag: 'TAG-0006' }).items.some((item) => item.tag === 'TAG-0006')).toBe(true)
  })

  it('creates an account with only the work the admin ticked', () => {
    const next = createAccount(createShop('owner'), { name: 'Counter two', email: 'till2@demo.goldflow.local', password: 'till', role: 'cashier', options: ['posSale'] })
    expect(next.accounts.at(-1)).toMatchObject({ email: 'till2@demo.goldflow.local', options: ['posSale'] })
    expect(() => createAccount(createShop('cashier'), { name: 'No', email: 'no@demo.goldflow.local', password: 'till', role: 'cashier', options: ['posSale'] })).toThrow(DeskError)
  })

  it('lets a cashier file a rate only after the admin approves that option', () => {
    expect(() => enterRate(createShop('cashier'), lkrToCents('40000'), 'Manual')).toThrow(DeskError)
    const opened = grantAccess(createShop('owner'), 'cashier', 'editGoldRates')
    const filed = enterRate({ ...opened, role: 'cashier' }, lkrToCents('40000'), 'Manual')
    expect(filed.rates.at(-1)?.status).toBe('pending_approval')
    expect(() => grantAccess(createShop('cashier'), 'accountant', 'posSale')).toThrow(DeskError)
  })
})
