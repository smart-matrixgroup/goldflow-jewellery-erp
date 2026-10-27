import { createShop, type Shop } from './desk.ts'

const key = 'goldflow.erp.books.v1'

export function loadBooks(): Shop {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return createShop('owner')
    const parsed = JSON.parse(raw) as Partial<Shop>
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.rates)) return createShop('owner')
    const fresh = createShop(parsed.role ?? 'owner')
    return {
      ...fresh,
      ...parsed,
      role: parsed.role ?? 'owner',
      workOrders: parsed.workOrders ?? [],
      oldGold: parsed.oldGold ?? [],
      cashClose: parsed.cashClose ?? null,
      grants: parsed.grants ?? [],
      accounts: Array.isArray(parsed.accounts) && parsed.accounts.some((account) => account.role === 'owner')
        ? parsed.accounts.map((account) => ({ ...account, options: account.options ?? [], password: account.password || 'owner' }))
        : fresh.accounts,
      items: [
        ...parsed.items ?? [],
        ...fresh.items.filter((item) => !(parsed.items ?? []).some((saved) => saved.tag === item.tag)),
      ],
      invoices: parsed.invoices.map((invoice) => ({ ...invoice, returnReason: invoice.returnReason || '' })),
      repairs: (parsed.repairs ?? []).map((job) => ({
        ...job,
        customerId: job.customerId || 'C1',
        itemLabel: job.itemLabel || 'Customer piece',
        receivedOn: job.receivedOn || '2026-10-27',
        dueOn: job.dueOn || '2026-11-03',
      })),
    }
  } catch {
    return createShop('owner')
  }
}

export function saveBooks(shop: Shop) {
  localStorage.setItem(key, JSON.stringify(shop))
}

export function emptyBooks(): Shop {
  localStorage.removeItem(key)
  return createShop('owner')
}
