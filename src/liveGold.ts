import Decimal from 'decimal.js'
import { lkrToCents, type Cents } from '@goldflow/shared'

const TROY_OUNCE_GRAMS = new Decimal('31.1034768')

export type LiveQuote = {
  purity: '24K' | '22K' | '18K'
  cents: Cents
  lkrPerGram: string
}

export type LiveBoard = {
  source: string
  fetchedAt: string
  warning: string | null
  quotes: LiveQuote[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function positive(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number) || number <= 0) return null
  return number
}

function quote(purity: LiveQuote['purity'], lkrPerGram: Decimal): LiveQuote | null {
  if (!lkrPerGram.isFinite() || lkrPerGram.lte(0)) return null
  const lkr = lkrPerGram.toFixed(2)
  return { purity, lkrPerGram: lkr, cents: lkrToCents(lkr) }
}

function boardFromGrams(grams: { k24: Decimal; k22: Decimal; k18: Decimal }, source: string, fetchedAt: string): LiveBoard | null {
  const quotes = [quote('24K', grams.k24), quote('22K', grams.k22), quote('18K', grams.k18)]
  if (quotes.some((entry) => !entry)) return null
  return { source, fetchedAt, warning: null, quotes: quotes as LiveQuote[] }
}

export function parseGoldApiPayload(body: unknown, fetchedAt: string): LiveBoard | null {
  const record = asRecord(body)
  if (!record) return null
  const melt = asRecord(record.melt_price_per_gram)
  const k24 = positive(melt?.['24k'])
  const k22 = positive(melt?.['22k'])
  const k18 = positive(melt?.['18k'])
  if (k24 && k22 && k18) {
    return boardFromGrams(
      { k24: new Decimal(k24), k22: new Decimal(k22), k18: new Decimal(k18) },
      'GoldAPI.io',
      typeof record.datetime === 'string' ? record.datetime : fetchedAt,
    )
  }
  const perUnit = asRecord(record.price_per_unit)
  const gram = positive(perUnit?.gram)
  if (!gram || record.currency !== 'LKR') return null
  const base = new Decimal(gram)
  return boardFromGrams({ k24: base, k22: base.mul(22).div(24), k18: base.mul(18).div(24) }, 'GoldAPI.io', fetchedAt)
}

export function quotesFromSpot(usdPerOunce: number, lkrPerUsd: number, fetchedAt: string, source = 'Public spot × USD/LKR'): LiveBoard | null {
  if (!Number.isFinite(usdPerOunce) || usdPerOunce <= 0 || !Number.isFinite(lkrPerUsd) || lkrPerUsd <= 0) return null
  const k24 = new Decimal(usdPerOunce).div(TROY_OUNCE_GRAMS).mul(lkrPerUsd)
  return boardFromGrams(
    { k24, k22: k24.mul(22).div(24), k18: k24.mul(18).div(24) },
    source,
    fetchedAt,
  )
}

function usdFromSwissquote(body: unknown): number | null {
  if (!Array.isArray(body)) return null
  const first = asRecord(body[0])
  const profiles = first?.spreadProfilePrices
  if (!Array.isArray(profiles)) return null
  const premium = asRecord(profiles.find((entry) => asRecord(entry)?.spreadProfile === 'premium') ?? profiles[0])
  const bid = positive(premium?.bid)
  const ask = positive(premium?.ask)
  if (bid && ask) return (bid + ask) / 2
  return bid ?? ask
}

export function usdPerOunce(body: unknown): number | null {
  const record = asRecord(body)
  if (record?.symbol === 'XAU') {
    const price = positive(record.price)
    if (price) return price
  }
  return usdFromSwissquote(body)
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>
}

async function fromGoldApi(apiKey: string, fetchedAt: string): Promise<LiveBoard | null> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const onDesk = import.meta.env.DEV
  if (apiKey.trim()) headers[onDesk ? 'x-gold-key' : 'x-access-token'] = apiKey.trim()
  const response = await fetch(onDesk ? '/api/gold/price/XAU/LKR' : 'https://www.goldapi.io/api/price/XAU/LKR', { headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) return null
  return parseGoldApiPayload(await readJson(response), fetchedAt)
}

async function fromPublicSpot(fetchedAt: string): Promise<LiveBoard | null> {
  const onDesk = import.meta.env.DEV
  const [spotResponse, fxResponse] = await Promise.all([
    fetch(onDesk ? '/api/spot/public-quotes/bboquotes/instrument/XAU/USD' : 'https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(20000) }),
    fetch(onDesk ? '/api/fx/v6/latest/USD' : 'https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(20000) }),
  ])
  if (!spotResponse.ok || !fxResponse.ok) return null
  const usd = usdPerOunce(await readJson(spotResponse))
  const fx = asRecord(await readJson(fxResponse))
  const rates = asRecord(fx?.rates)
  const lkr = positive(rates?.LKR)
  if (!usd || !lkr) return null
  return quotesFromSpot(usd, lkr, fetchedAt, onDesk ? 'Swissquote XAU/USD × LKR' : 'Gold spot × LKR')
}

export async function fetchLiveBoard(apiKey: string): Promise<LiveBoard> {
  const fetchedAt = new Date().toISOString()
  if (import.meta.env.DEV || apiKey.trim()) {
    try {
      const direct = await fromGoldApi(apiKey, fetchedAt)
      if (direct) return direct
    } catch {
      // GoldAPI.io did not answer. The public spot rate is the fallback.
    }
  }
  const spot = await fromPublicSpot(fetchedAt).catch(() => null)
  if (!spot) {
    throw new Error('GoldAPI.io did not return a rate, and the public spot rate is unavailable. The approved shop rate is unchanged.')
  }
  return spot
}
