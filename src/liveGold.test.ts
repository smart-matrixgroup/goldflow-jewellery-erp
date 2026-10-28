import { describe, expect, it } from 'vitest'
import { lkrToCents } from '@goldflow/shared'
import { parseGoldApiPayload, quotesFromSpot, usdPerOunce } from './liveGold.ts'

describe('live gold rates', () => {
  it('reads karat gram prices from a GoldAPI payload', () => {
    const board = parseGoldApiPayload(
      {
        datetime: '2026-10-26T18:00:00Z',
        currency: 'LKR',
        melt_price_per_gram: { '24k': 45000.129, '22k': 41250.12, '18k': 33750.1 },
      },
      '2026-10-26T18:00:01Z',
    )
    expect(board?.source).toBe('GoldAPI.io')
    expect(board?.quotes.map((quote) => quote.purity)).toEqual(['24K', '22K', '18K'])
    expect(board?.quotes[1]?.cents).toBe(lkrToCents('41250.12'))
  })

  it('rejects a zero or missing provider price', () => {
    expect(parseGoldApiPayload({ melt_price_per_gram: { '24k': 0, '22k': 10, '18k': 8 } }, '2026-10-26T00:00:00Z')).toBeNull()
    expect(parseGoldApiPayload({ price: 0 }, '2026-10-26T00:00:00Z')).toBeNull()
    expect(quotesFromSpot(0, 300, '2026-10-26T00:00:00Z')).toBeNull()
  })

  it('reads a public ounce price', () => {
    expect(usdPerOunce({ symbol: 'XAU', price: 4048.8 })).toBe(4048.8)
    expect(usdPerOunce({ symbol: 'XAU', price: 0 })).toBeNull()
  })

  it('turns a spot ounce into 24K, 22K and 18K gram rates', () => {
    const board = quotesFromSpot(4019, 300, '2026-10-26T18:25:47Z')
    expect(board?.source).toBe('Public spot × USD/LKR')
    const [k24, k22, k18] = board?.quotes ?? []
    expect(k24 && k22 && k18).toBeTruthy()
    expect(k24!.cents).toBeGreaterThan(k22!.cents)
    expect(k22!.cents).toBeGreaterThan(k18!.cents)
  })
})
