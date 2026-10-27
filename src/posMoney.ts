export type Tender = { method: string; cents: number }

export function changeDue(totalCents: number, receivedCents: number, creditCents: number) {
  const owing = Math.max(0, totalCents - creditCents)
  return {
    owing,
    change: Math.max(0, receivedCents - owing),
    balance: Math.max(0, owing - receivedCents),
  }
}

export function roundUpCents(cents: number, stepRupees: number) {
  const step = stepRupees * 100
  if (step <= 0) return cents
  return Math.ceil(cents / step) * step
}

/** Spread tender slices across line totals without paying any line more than it costs. */
export function distributePayments(lines: { tag: string; cents: number }[], payments: Tender[]) {
  const buckets = payments.map((payment) => ({ ...payment }))
  return lines.map((line) => {
    let need = line.cents
    const taken: Tender[] = []
    for (const bucket of buckets) {
      if (need <= 0) break
      const use = Math.min(bucket.cents, need)
      if (use > 0) {
        taken.push({ method: bucket.method, cents: use })
        bucket.cents -= use
        need -= use
      }
    }
    return { tag: line.tag, payments: taken, short: need }
  })
}
