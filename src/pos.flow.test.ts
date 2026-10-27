import { describe, expect, it } from 'vitest'
import { createShop, quoteItem, sell } from './desk.ts'
import { changeDue, distributePayments, roundUpCents } from './posMoney.ts'

describe('till money', () => {
  it('gives change when cash is over the total', () => {
    expect(changeDue(10_000, 15_000, 0)).toEqual({ owing: 10_000, change: 5_000, balance: 0 })
  })

  it('keeps a balance when old-gold credit does not cover the bill', () => {
    expect(changeDue(10_000, 4_000, 1_000)).toEqual({ owing: 9_000, change: 0, balance: 5_000 })
  })

  it('rounds a tender up to the next rupee step', () => {
    expect(roundUpCents(10_050, 100)).toBe(20_000)
  })

  it('splits a tender across two lines without paying either line too much', () => {
    const rows = distributePayments(
      [
        { tag: 'A', cents: 6_000 },
        { tag: 'B', cents: 4_000 },
      ],
      [
        { method: 'cash', cents: 7_000 },
        { method: 'card', cents: 3_000 },
      ],
    )
    expect(rows[0]).toEqual({ tag: 'A', payments: [{ method: 'cash', cents: 6_000 }], short: 0 })
    expect(rows[1]?.payments).toEqual([
      { method: 'cash', cents: 1_000 },
      { method: 'card', cents: 3_000 },
    ])
    expect(rows[1]?.short).toBe(0)
  })
})

describe('sale posting', () => {
  it('keeps a single invoice when the same key is sent twice', () => {
    const shop = createShop()
    const total = quoteItem(shop, 'TAG-0004')
    const once = sell(shop, { tag: 'TAG-0004', customerId: 'C1', payments: [{ method: 'cash', cents: total }], key: 'till-1' })
    const twice = sell(once, { tag: 'TAG-0004', customerId: 'C1', payments: [{ method: 'cash', cents: total }], key: 'till-1' })
    expect(twice.invoices.filter((invoice) => invoice.key === 'till-1')).toHaveLength(1)
    expect(twice.items.find((item) => item.tag === 'TAG-0004')?.status).toBe('sold')
    expect(twice.invoices.at(-1)?.rateCentsPerGram).toBe(once.invoices.at(-1)?.rateCentsPerGram)
  })

  it('stores a short payment as credit and refuses a sale with nothing received', () => {
    const shop = createShop()
    const total = quoteItem(shop, 'TAG-0004')
    const partial = sell(shop, { tag: 'TAG-0004', customerId: 'C1', payments: [{ method: 'cash', cents: 10_000 }], key: 'credit-1' })
    const invoice = partial.invoices.at(-1)
    expect(invoice?.status).toBe('credit')
    expect(invoice?.paidCents).toBeLessThan(total)
    expect(invoice?.paidCents).toBe(10_000)
    expect(() => sell(createShop(), { tag: 'TAG-0003', customerId: 'C1', payments: [], key: 'zero' })).toThrow(/Payment does not match/)
  })
})
