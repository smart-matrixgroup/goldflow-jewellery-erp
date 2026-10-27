import { describe, expect, it } from 'vitest'
import { lkrToCents } from '@goldflow/shared'
import {
  approveAdjustment,
  approveRate,
  closeCash,
  closeRepair,
  closeWorkOrder,
  confirmPurchase,
  createShop,
  DeskError,
  dispatchTransfer,
  enterRate,
  intakeOldGold,
  invoiceTotal,
  openManufacturing,
  openRepair,
  paySupplier,
  postJournal,
  profitFor,
  proposeAdjustment,
  quoteItem,
  receiveTransfer,
  returnInvoice,
  sell,
  settleCredit,
  takeRepairAdvance,
} from './desk.ts'

const cash = (cents: number) => [{ method: 'cash', cents }]

describe('report smoke checks', () => {
  it('follows the report acceptance path from rate to profit', () => {
    const denied = () => enterRate(createShop('cashier'), lkrToCents('40000'), 'Manual')
    expect(denied).toThrow(DeskError)
    try {
      denied()
    } catch (error) {
      expect((error as DeskError).shop.audit.at(-1)?.action).toBe('rate.denied')
    }
    expect(() => enterRate(createShop(), 0, 'bad')).toThrow(/zero/)

    const firstTotal = quoteItem(createShop(), 'TAG-0001')
    expect(firstTotal).toBe(invoiceTotal(createShop()))
    const sold = sell(createShop(), { tag: 'TAG-0001', payments: cash(firstTotal), key: 'smoke-1', customerId: 'C1' })
    const drafted = enterRate(sold, lkrToCents('41000'), 'Live board')
    const approved = approveRate(drafted, drafted.rates.at(-1)!.id)
    const secondTotal = quoteItem(approved, 'TAG-0003')
    const again = sell(approved, { tag: 'TAG-0003', payments: cash(secondTotal), key: 'smoke-2', customerId: 'C1' })
    expect(again.invoices[0]?.rateCentsPerGram).toBe(lkrToCents('39108.97'))
    expect(again.invoices[1]?.rateCentsPerGram).toBe(lkrToCents('41000'))
    expect(() => sell(again, { tag: 'TAG-0001', payments: cash(1), key: 'smoke-3', customerId: 'C1' })).toThrow(/not available/)

    const received = confirmPurchase(createShop(), 'PO-1')
    expect(received.items.some((item) => item.tag === 'TAG-0099' && item.status === 'available')).toBe(true)
    const receivedSale = sell(received, { tag: 'TAG-0099', payments: cash(quoteItem(received, 'TAG-0099')), key: 'recv', customerId: 'C1' })
    expect(receivedSale.movements.filter((movement) => movement.tag === 'TAG-0099').map((movement) => movement.reason)).toEqual(['purchase_receipt', 'sale'])
    expect(() => sell(receivedSale, { tag: 'TAG-0099', payments: cash(1), key: 'recv-2', customerId: 'C1' })).toThrow(/not available/)

    const splitTotal = quoteItem(createShop(), 'TAG-0004')
    const half = Math.floor(splitTotal / 2)
    const split = sell(createShop(), {
      tag: 'TAG-0004',
      payments: [
        { method: 'cash', cents: half },
        { method: 'card', cents: splitTotal - half },
      ],
      key: 'split',
      customerId: 'C2',
    })
    expect(split.invoices[0]?.payments.reduce((sum, payment) => sum + payment.cents, 0)).toBe(splitTotal)
    const closed = closeCash(split, half)
    expect(closed.cashClose?.invoicesCents).toBe(half)
    expect(closed.cashClose?.cardCents).toBe(splitTotal - half)

    const credited = intakeOldGold(createShop(), 'C1', lkrToCents('1000'), { purity: '22K', grams: '1' })
    const exchangeTotal = quoteItem(credited, 'TAG-0001')
    const exchanged = sell(credited, { tag: 'TAG-0001', payments: cash(exchangeTotal - lkrToCents('1000')), key: 'og', customerId: 'C1' })
    expect(exchanged.invoices[0]?.payments.some((payment) => payment.method === 'old_gold_credit')).toBe(true)
    expect(exchanged.customers[0]?.oldGoldCents).toBe(0)
    expect(exchanged.oldGold).toHaveLength(1)

    const returned = returnInvoice(exchanged, exchanged.invoices[0]!.id, 'Size')
    expect(returned.items.find((item) => item.tag === 'TAG-0001')?.status).toBe('available')
    expect(returned.invoices[0]?.returnReason).toBe('Size')
    expect(profitFor(returned).netSalesCents).toBe(0)
    expect(() => returnInvoice(returned, returned.invoices[0]!.id)).toThrow(/original/)

    const job = closeRepair(takeRepairAdvance(openRepair(createShop(), lkrToCents('8000'), 'C1', 'Chain'), 'R-1', lkrToCents('3000')), 'R-1')
    expect(job.repairs[0]).toMatchObject({ status: 'closed', advanceCents: lkrToCents('3000'), estimateCents: lkrToCents('8000') })

    const counted = approveAdjustment(proposeAdjustment(createShop(), 'TAG-0001', 'sold', 'Missing on count'), 'ADJ-1')
    expect(counted.adjustments[0]).toMatchObject({ before: 'available', after: 'sold', approved: true })
    expect(counted.audit.some((entry) => entry.action.startsWith('adjust.approved'))).toBe(true)

    const moved = receiveTransfer(dispatchTransfer(createShop(), 'TAG-0002', 'vault'), 'TR-1')
    expect(moved.items.find((item) => item.tag === 'TAG-0002')?.branch).toBe('vault')

    const owing = confirmPurchase(createShop(), 'PO-1')
    const paid = paySupplier(owing, 'S1', lkrToCents('50000'))
    expect(paid.suppliers[0]?.balanceCents).toBe(lkrToCents('150000'))

    const partial = sell(createShop(), { tag: 'TAG-0003', payments: cash(lkrToCents('1000')), key: 'credit', customerId: 'C1' })
    expect(partial.invoices[0]?.status).toBe('credit')
    const settled = settleCredit(partial, 'INV-1', cash(partial.invoices[0]!.totalCents - lkrToCents('1000')))
    expect(settled.invoices[0]?.status).toBe('completed')

    expect(() => postJournal(createShop(), 10, 11, 'test')).toThrow(/balance/)
    expect(postJournal(createShop(), 10, 10, 'test').journals).toHaveLength(1)

    const workshop = closeWorkOrder(openManufacturing(createShop(), '8.5', lkrToCents('4000')), 'WO-1', '0.4')
    expect(workshop.workOrders[0]).toMatchObject({ status: 'closed', issuedGrams: '8.5', returnedGrams: '0.4' })
    expect(() => openManufacturing(createShop('cashier'))).toThrow(DeskError)
  })
})