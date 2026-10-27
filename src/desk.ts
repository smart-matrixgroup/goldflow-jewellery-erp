import {
  calculatePrice,
  calculateProfit,
  can,
  capabilities,
  gramsToMg,
  lkrToCents,
  reportExampleInputs,
  type Capability,
  type Cents,
  type PriceBreakdown,
  type Role,
} from '@goldflow/shared'

export class DeskError extends Error {
  shop: Shop
  constructor(message: string, shop: Shop) {
    super(message)
    this.shop = shop
  }
}

export type DeskItem = {
  tag: string
  name: string
  status: 'available' | 'sold'
  branch: string
  supplierId: string
  category: string
  purity: string
  grossGrams: string
  stoneGrams: string
  netGrams: string
  hallmark: string
  makingCents: Cents
  wastageCents: Cents
  stoneValueCents: Cents
  discountCents: Cents
  costCents: Cents
}

const pieceDefaults = {
  category: 'Rings',
  purity: '22K',
  grossGrams: '8',
  stoneGrams: '0',
  netGrams: '8.000',
  hallmark: 'Hallmarked',
  makingCents: lkrToCents('5000'),
  wastageCents: lkrToCents('2000'),
  stoneValueCents: lkrToCents('3000'),
  discountCents: lkrToCents('1000'),
  costCents: lkrToCents('250000'),
}

function piece(input: Pick<DeskItem, 'tag' | 'name' | 'status' | 'branch' | 'supplierId'> & Partial<DeskItem>): DeskItem {
  return { ...pieceDefaults, ...input }
}

export type Shop = {
  role: Role
  rates: { id: string; purity: string; rateType: string; cents: Cents; source: string; effectiveAt: string; status: string }[]
  items: DeskItem[]
  purchases: {
    id: string
    status: 'draft' | 'confirmed' | 'cancelled'
    tag: string
    supplierId: string
    costCents: Cents
    name: string
    purity: string
    grossGrams: string
    netGrams: string
  }[]
  suppliers: { id: string; name: string; balanceCents: Cents }[]
  customers: { id: string; name: string; phone: string; oldGoldCents: Cents }[]
  oldGold: { id: string; customerId: string; purity: string; grams: string; cents: Cents }[]
  invoices: {
    id: string
    status: 'completed' | 'credit' | 'returned'
    tag: string
    customerId: string
    totalCents: Cents
    paidCents: Cents
    rateCentsPerGram: Cents
    payments: { method: string; cents: Cents }[]
    key: string
    returnReason: string
  }[]
  repairs: { id: string; status: 'open' | 'closed'; advanceCents: Cents; estimateCents: Cents; customerId: string; itemLabel: string; receivedOn: string; dueOn: string }[]
  workOrders: { id: string; issuedGrams: string; returnedGrams: string; labourCents: Cents; status: 'open' | 'closed' }[]
  expenses: { id: string; category: string; cents: Cents }[]
  journals: { id: string; debit: Cents; credit: Cents; source: string }[]
  adjustments: { id: string; tag: string; before: 'available' | 'sold'; after: 'available' | 'sold'; approved: boolean; reason: string }[]
  transfers: { id: string; tag: string; from: string; to: string; status: 'dispatched' | 'received' }[]
  movements: { tag: string; reason: string; ref: string }[]
  audit: { action: string; role: Role; at: string }[]
  cashClose: { invoicesCents: Cents; countedCents: Cents; cardCents: Cents; bankCents: Cents } | null
  manufacturingOrders: number
  grants: { role: Role; capability: Capability }[]
  accountId?: string
  accounts: DeskAccount[]
}

export type DeskAccount = {
  id: string
  name: string
  email: string
  password: string
  role: Role
  options: Capability[]
}

const at = '2026-10-25T01:00:00+05:30'

export function createShop(role: Role = 'owner'): Shop {
  return {
    role,
    rates: [
      {
        id: 'rate-1',
        purity: '22K',
        rateType: 'shop_selling',
        cents: lkrToCents('39108.97'),
        source: 'GoldPriceToday.lk',
        effectiveAt: at,
        status: 'approved',
      },
    ],
    items: [
      piece({ tag: 'TAG-0001', name: 'Aurora Solitaire', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Rings' }),
      piece({ tag: 'TAG-0002', name: 'Cascade Necklace', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Necklaces', grossGrams: '12.4', stoneGrams: '0.4', netGrams: '12.000', costCents: lkrToCents('280000') }),
      piece({ tag: 'TAG-0003', name: 'Lumen Studs', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Earrings', grossGrams: '4.2', stoneGrams: '0.2', netGrams: '4.000', stoneValueCents: lkrToCents('1500'), costCents: lkrToCents('90000') }),
      piece({ tag: 'TAG-0004', name: 'Seed Pendant', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Pendants', grossGrams: '6.1', stoneGrams: '0.1', netGrams: '6.000', costCents: lkrToCents('160000') }),
      piece({ tag: 'TAG-0007', name: 'Lotus Ring', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Rings', grossGrams: '5.4', stoneGrams: '0.2', netGrams: '5.200', costCents: lkrToCents('140000') }),
      piece({ tag: 'TAG-0008', name: 'Heritage Band', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Rings', grossGrams: '6.6', stoneGrams: '0', netGrams: '6.400', costCents: lkrToCents('170000') }),
      piece({ tag: 'TAG-0009', name: 'Ceylon Halo', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Rings', grossGrams: '7.4', stoneGrams: '0.3', netGrams: '7.100', stoneValueCents: lkrToCents('12000'), costCents: lkrToCents('210000') }),
      piece({ tag: 'TAG-0010', name: 'Pearl Strand', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Necklaces', grossGrams: '16.2', stoneGrams: '0.6', netGrams: '15.600', costCents: lkrToCents('340000') }),
      piece({ tag: 'TAG-0011', name: 'Temple Chain', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Necklaces', grossGrams: '14.1', stoneGrams: '0', netGrams: '14.000', costCents: lkrToCents('300000') }),
      piece({ tag: 'TAG-0012', name: 'Drop Earrings', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Earrings', grossGrams: '3.4', stoneGrams: '0.2', netGrams: '3.200', costCents: lkrToCents('78000') }),
      piece({ tag: 'TAG-0013', name: 'Jhumka Pair', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Earrings', grossGrams: '5.8', stoneGrams: '0.3', netGrams: '5.500', stoneValueCents: lkrToCents('4000'), costCents: lkrToCents('120000') }),
      piece({ tag: 'TAG-0014', name: 'Om Pendant', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Pendants', grossGrams: '4.9', stoneGrams: '0.1', netGrams: '4.800', costCents: lkrToCents('110000') }),
      piece({ tag: 'TAG-0015', name: 'Coin Pendant', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Pendants', grossGrams: '8.4', stoneGrams: '0', netGrams: '8.200', costCents: lkrToCents('190000') }),
      piece({ tag: 'TAG-0016', name: 'Kada Bangle', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Bangles', grossGrams: '12.4', stoneGrams: '0', netGrams: '12.000', costCents: lkrToCents('260000') }),
      piece({ tag: 'TAG-0017', name: 'Bridal Bangle', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Bangles', grossGrams: '9.8', stoneGrams: '0.2', netGrams: '9.500', costCents: lkrToCents('220000') }),
      piece({ tag: 'TAG-0018', name: 'Rope Chain', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Necklaces', grossGrams: '10.2', stoneGrams: '0', netGrams: '10.000', costCents: lkrToCents('210000') }),
      piece({ tag: 'TAG-0019', name: 'Box Chain', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Necklaces', grossGrams: '8.1', stoneGrams: '0', netGrams: '8.000', costCents: lkrToCents('175000') }),
      piece({ tag: 'TAG-0020', name: 'Tennis Bracelet', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Bangles', grossGrams: '11.3', stoneGrams: '0.4', netGrams: '10.800', stoneValueCents: lkrToCents('18000'), costCents: lkrToCents('280000') }),
      piece({ tag: 'TAG-0021', name: 'Cuff Bracelet', status: 'available', branch: 'showroom', supplierId: 'S1', category: 'Bangles', grossGrams: '15.2', stoneGrams: '0', netGrams: '15.000', costCents: lkrToCents('320000') }),
    ],
    purchases: [
      {
        id: 'PO-1',
        status: 'draft',
        tag: 'TAG-0099',
        supplierId: 'S1',
        costCents: lkrToCents('200000'),
        name: 'Received piece',
        purity: '22K',
        grossGrams: '8',
        netGrams: '8.000',
      },
    ],
    suppliers: [{ id: 'S1', name: 'Colombo Bench', balanceCents: 0 }],
    customers: [
      { id: 'C1', name: 'Amaya Perera', phone: '077 000 1101', oldGoldCents: 0 },
      { id: 'C2', name: 'Nimal Fernando', phone: '077 000 2202', oldGoldCents: 0 },
    ],
    oldGold: [],
    invoices: [],
    repairs: [],
    workOrders: [],
    expenses: [{ id: 'EX-1', category: 'rent', cents: lkrToCents('25000') }],
    journals: [],
    adjustments: [],
    transfers: [],
    movements: [],
    audit: [],
    cashClose: null,
    manufacturingOrders: 0,
    grants: [],
    accounts: seedAccounts(),
  }
}

export function roleWork(role: Role): Capability[] {
  return (Object.values(capabilities) as Capability[]).filter((capability) => can(role, capability) && capability !== 'manageUsers' && capability !== 'manageSettings' && capability !== 'addProducts')
}

function seedAccounts(): DeskAccount[] {
  const rows: { id: string; name: string; email: string; password: string; role: Role }[] = [
    { id: 'A1', name: 'Admin', email: 'owner@demo.goldflow.local', password: 'owner', role: 'owner' },
    { id: 'A2', name: 'Manager', email: 'manager@demo.goldflow.local', password: 'manager', role: 'manager' },
    { id: 'A3', name: 'Cashier', email: 'cashier@demo.goldflow.local', password: 'cashier', role: 'cashier' },
    { id: 'A4', name: 'Accountant', email: 'accountant@demo.goldflow.local', password: 'accountant', role: 'accountant' },
    { id: 'A5', name: 'Storekeeper', email: 'store@demo.goldflow.local', password: 'store', role: 'storekeeper' },
  ]
  return rows.map((row) => ({ ...row, options: row.role === 'owner' ? (Object.values(capabilities) as Capability[]) : roleWork(row.role) }))
}

function stamp(shop: Shop, action: string): Shop {
  return { ...shop, audit: [...shop.audit, { action, role: shop.role, at: new Date().toISOString() }] }
}

function deny(shop: Shop, action: string): never {
  throw new DeskError('Permission denied', stamp(shop, action))
}

export function permits(shop: Shop, capability: Capability): boolean {
  if (shop.accountId) {
    const account = shop.accounts.find((entry) => entry.id === shop.accountId)
    if (account) {
      if (account.role === 'owner') return true
      if (account.options.includes(capability)) return true
      return shop.grants.some((grant) => grant.role === account.role && grant.capability === capability)
    }
  }
  if (can(shop.role, capability)) return true
  return shop.grants.some((grant) => grant.role === shop.role && grant.capability === capability)
}

export function grantAccess(shop: Shop, role: Role, capability: Capability): Shop {
  if (!can(shop.role, 'manageUsers')) deny(shop, 'grant.denied')
  if (role === 'owner') throw new DeskError('The admin already has every option', shop)
  if (can(role, capability)) throw new DeskError('That option is already part of this role', shop)
  if (shop.grants.some((grant) => grant.role === role && grant.capability === capability)) return shop
  return stamp({ ...shop, grants: [...shop.grants, { role, capability }] }, `grant:${role}:${capability}`)
}

export function revokeAccess(shop: Shop, role: Role, capability: Capability): Shop {
  if (!can(shop.role, 'manageUsers')) deny(shop, 'grant.denied')
  return stamp(
    { ...shop, grants: shop.grants.filter((grant) => grant.role !== role || grant.capability !== capability) },
    `revoke:${role}:${capability}`,
  )
}

function sellingRate(shop: Shop, purity = '22K') {
  const rate = [...shop.rates].reverse().find((entry) => entry.status === 'approved' && entry.rateType === 'shop_selling' && entry.purity === purity)
  if (!rate || rate.cents <= 0) throw new DeskError('No approved selling rate', stamp(shop, 'rate.missing'))
  return rate
}

function inputsFor(item: DeskItem, rate: Shop['rates'][number]) {
  return reportExampleInputs({
    grossMg: gramsToMg(item.grossGrams),
    stoneMg: gramsToMg(item.stoneGrams),
    otherExcludedMg: 0,
    rate: {
      purity: item.purity,
      rateType: rate.rateType,
      source: rate.source,
      unit: 'gram',
      rateCentsPerGram: rate.cents,
      effectiveAt: rate.effectiveAt,
      labelledAs: 'snapshot',
    },
    wastage: { mode: 'fixedMoney', amountCents: item.wastageCents },
    making: { mode: 'fixed', amountCents: item.makingCents },
    stoneValueCents: item.stoneValueCents,
    discountCents: item.discountCents,
  })
}

function priceOf(shop: Shop, item: DeskItem): PriceBreakdown {
  const priced = calculatePrice(inputsFor(item, sellingRate(shop, item.purity)))
  if (!priced.ok) throw new DeskError('Price failed', shop)
  return priced.breakdown
}

export function quoteItem(shop: Shop, tag: string): Cents {
  const item = shop.items.find((entry) => entry.tag === tag)
  if (!item) throw new DeskError('Unknown tag', shop)
  return priceOf(shop, item).totalCents
}

export function quoteBreakdown(shop: Shop, tag: string): PriceBreakdown {
  const item = shop.items.find((entry) => entry.tag === tag)
  if (!item) throw new DeskError('Unknown tag', shop)
  return priceOf(shop, item)
}

export function enterRate(shop: Shop, cents: Cents, source: string, purity = '22K', rateType = 'shop_selling'): Shop {
  if (!permits(shop, 'editGoldRates')) deny(shop, 'rate.denied')
  if (cents <= 0) throw new DeskError('Rate cannot be zero', shop)
  return stamp(
    {
      ...shop,
      rates: [
        ...shop.rates,
        {
          id: `rate-${shop.rates.length + 1}`,
          purity,
          rateType,
          cents,
          source,
          effectiveAt: new Date().toISOString(),
          status: 'pending_approval',
        },
      ],
    },
    'rate.entered',
  )
}

export function approveRate(shop: Shop, id: string): Shop {
  if (!permits(shop, 'approveGoldRates')) deny(shop, 'rate.approve_denied')
  return stamp(
    { ...shop, rates: shop.rates.map((rate) => (rate.id === id ? { ...rate, status: 'approved' } : rate)) },
    `rate.approved:${id}`,
  )
}

export function draftPurchase(
  shop: Shop,
  input: { tag: string; supplierId: string; costCents: Cents; name?: string; purity?: string; grossGrams?: string; netGrams?: string },
): Shop {
  if (!permits(shop, 'managePurchases')) deny(shop, 'purchase.denied')
  const tag = input.tag.trim().toUpperCase()
  if (!tag) throw new DeskError('A tag is required', shop)
  if (shop.items.some((item) => item.tag === tag) || shop.purchases.some((entry) => entry.tag === tag && entry.status !== 'cancelled')) {
    throw new DeskError('That tag is already on the desk', shop)
  }
  if (input.costCents <= 0) throw new DeskError('Purchase cost must be above zero', shop)
  return stamp(
    {
      ...shop,
      purchases: [
        ...shop.purchases,
        {
          id: `PO-${shop.purchases.length + 1}`,
          status: 'draft',
          tag,
          supplierId: input.supplierId,
          costCents: input.costCents,
          name: input.name?.trim() || 'Received piece',
          purity: input.purity || '22K',
          grossGrams: input.grossGrams || '8',
          netGrams: input.netGrams || '8.000',
        },
      ],
    },
    'purchase.drafted',
  )
}

const assignable = new Set<Capability>(Object.values(capabilities).filter((capability) => capability !== 'manageUsers' && capability !== 'manageSettings'))

export function createAccount(
  shop: Shop,
  input: { name: string; email: string; password: string; role: Role; options: Capability[] },
): Shop {
  if (!permits(shop, 'manageUsers')) deny(shop, 'account.denied')
  if (input.role === 'owner') throw new DeskError('The admin account already exists', shop)
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password.trim()
  if (!name || !email || password.length < 4) throw new DeskError('Name, email and a password of at least 4 characters are required', shop)
  if (shop.accounts.some((account) => account.email === email)) throw new DeskError('That email is already a desk account', shop)
  const options = [...new Set(input.options)].filter((capability) => assignable.has(capability))
  return stamp(
    {
      ...shop,
      accounts: [...shop.accounts, { id: `A${shop.accounts.length + 1}`, name, email, password, role: input.role, options }],
    },
    'account.created',
  )
}

export function setAccountOptions(shop: Shop, id: string, options: Capability[]): Shop {
  if (!permits(shop, 'manageUsers')) deny(shop, 'account.denied')
  const account = shop.accounts.find((entry) => entry.id === id)
  if (!account) throw new DeskError('Unknown account', shop)
  if (account.role === 'owner') throw new DeskError('The admin keeps every option', shop)
  const next = [...new Set(options)].filter((capability) => assignable.has(capability))
  return stamp(
    { ...shop, accounts: shop.accounts.map((entry) => (entry.id === id ? { ...entry, options: next } : entry)) },
    `account.options:${id}`,
  )
}

export function addProduct(
  shop: Shop,
  input: {
    tag: string
    name: string
    category: string
    purity: string
    grossGrams: string
    stoneGrams: string
    netGrams: string
    makingCents: Cents
    stoneValueCents: Cents
    discountCents: Cents
    costCents: Cents
  },
): Shop {
  if (!permits(shop, 'addProducts')) deny(shop, 'product.denied')
  const tag = input.tag.trim().toUpperCase()
  const name = input.name.trim()
  if (!tag || !name) throw new DeskError('A tag and a name are required', shop)
  if (shop.items.some((item) => item.tag === tag)) throw new DeskError('That tag is already on the desk', shop)
  if (input.makingCents < 0 || input.stoneValueCents < 0 || input.discountCents < 0 || input.costCents <= 0) {
    throw new DeskError('Charges cannot be negative, and the tag cost must be above zero', shop)
  }
  const gross = Number(input.grossGrams)
  const stone = Number(input.stoneGrams)
  const net = Number(input.netGrams)
  if (!Number.isFinite(gross) || !Number.isFinite(stone) || !Number.isFinite(net) || gross <= 0 || stone < 0 || net <= 0 || stone > gross) {
    throw new DeskError('Check the gross, stone and net weights', shop)
  }
  return stamp(
    {
      ...shop,
      items: [
        ...shop.items,
        piece({
          tag,
          name,
          status: 'available',
          branch: 'showroom',
          supplierId: shop.suppliers[0]?.id ?? 'S1',
          category: input.category || 'Other',
          purity: input.purity || '22K',
          grossGrams: input.grossGrams,
          stoneGrams: input.stoneGrams,
          netGrams: input.netGrams,
          makingCents: input.makingCents,
          stoneValueCents: input.stoneValueCents,
          discountCents: input.discountCents,
          wastageCents: 0,
          costCents: input.costCents,
        }),
      ],
    },
    `product.added:${tag}`,
  )
}

export function addCustomer(shop: Shop, name: string, phone: string): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'customer.denied')
  const trimmed = name.trim()
  if (!trimmed) throw new DeskError('Customer name is required', shop)
  return stamp(
    {
      ...shop,
      customers: [...shop.customers, { id: `C${shop.customers.length + 1}`, name: trimmed, phone: phone.trim(), oldGoldCents: 0 }],
    },
    'customer.added',
  )
}

export function confirmPurchase(shop: Shop, id: string): Shop {
  if (!permits(shop, 'receiveStock')) deny(shop, 'purchase.denied')
  const purchase = shop.purchases.find((entry) => entry.id === id)
  if (!purchase || purchase.status === 'cancelled') throw new DeskError('Purchase cannot be confirmed', shop)
  if (purchase.status === 'confirmed') return shop
  return stamp(
    {
      ...shop,
      purchases: shop.purchases.map((entry) => (entry.id === id ? { ...entry, status: 'confirmed' } : entry)),
      items: [
        ...shop.items,
        piece({
          tag: purchase.tag,
          name: purchase.name,
          status: 'available',
          branch: 'showroom',
          supplierId: purchase.supplierId,
          costCents: purchase.costCents,
          purity: purchase.purity,
          grossGrams: purchase.grossGrams,
          netGrams: purchase.netGrams,
        }),
      ],
      suppliers: shop.suppliers.map((supplier) =>
        supplier.id === purchase.supplierId ? { ...supplier, balanceCents: supplier.balanceCents + purchase.costCents } : supplier,
      ),
      movements: [...shop.movements, { tag: purchase.tag, reason: 'purchase_receipt', ref: id }],
    },
    `purchase.confirmed:${id}`,
  )
}

export function sell(
  shop: Shop,
  input: { tag: string; payments: { method: string; cents: Cents }[]; key: string; customerId: string },
): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'sale.denied')
  const existing = shop.invoices.find((invoice) => invoice.key === input.key)
  if (existing) return shop
  const item = shop.items.find((entry) => entry.tag === input.tag)
  if (!item || item.status !== 'available') throw new DeskError('Item is not available', shop)
  const customer = shop.customers.find((entry) => entry.id === input.customerId)
  if (!customer) throw new DeskError('Unknown customer', shop)
  const priced = priceOf(shop, item)
  const total = priced.totalCents
  const rate = priced.rate
  const cashPaid = input.payments.reduce((sum, payment) => sum + payment.cents, 0)
  const credit = Math.min(customer?.oldGoldCents ?? 0, Math.max(0, total - cashPaid))
  const payments = credit > 0 ? [...input.payments, { method: 'old_gold_credit', cents: credit }] : input.payments
  const paid = cashPaid + credit
  if (paid <= 0 || paid > total) throw new DeskError('Payment does not match the invoice', shop)
  const invoice = {
    id: `INV-${shop.invoices.length + 1}`,
    status: paid === total ? ('completed' as const) : ('credit' as const),
    tag: input.tag,
    customerId: input.customerId,
    totalCents: total,
    paidCents: paid,
    rateCentsPerGram: rate.rateCentsPerGram,
    payments,
    key: input.key,
    returnReason: '',
  }
  return stamp(
    {
      ...shop,
      customers: shop.customers.map((entry) =>
        entry.id === input.customerId ? { ...entry, oldGoldCents: entry.oldGoldCents - credit } : entry,
      ),
      items: shop.items.map((entry) => (entry.tag === input.tag ? { ...entry, status: 'sold' } : entry)),
      invoices: [...shop.invoices, invoice],
      movements: [...shop.movements, { tag: input.tag, reason: 'sale', ref: invoice.id }],
    },
    `sale.completed:${invoice.id}`,
  )
}

export function invoiceTotal(shop: Shop): Cents {
  const rate = sellingRate(shop)
  const priced = calculatePrice(
    reportExampleInputs({
      rate: {
        purity: rate.purity,
        rateType: rate.rateType,
        source: rate.source,
        unit: 'gram',
        rateCentsPerGram: rate.cents,
        effectiveAt: rate.effectiveAt,
        labelledAs: 'snapshot',
      },
    }),
  )
  if (!priced.ok) throw new DeskError('Price failed', shop)
  return priced.breakdown.totalCents
}

export function returnInvoice(shop: Shop, invoiceId: string, reason = 'Customer return'): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'return.denied')
  const invoice = shop.invoices.find((entry) => entry.id === invoiceId)
  if (!invoice || invoice.status === 'returned') throw new DeskError('Return must reference the original invoice', shop)
  if (invoice.status === 'credit') throw new DeskError('Settle the invoice before returning it', shop)
  const restored = invoice.payments.filter((payment) => payment.method === 'old_gold_credit').reduce((sum, payment) => sum + payment.cents, 0)
  return stamp(
    {
      ...shop,
      customers: shop.customers.map((customer) =>
        customer.id === invoice.customerId ? { ...customer, oldGoldCents: customer.oldGoldCents + restored } : customer,
      ),
      invoices: shop.invoices.map((entry) => (entry.id === invoiceId ? { ...entry, status: 'returned' as const, returnReason: reason } : entry)),
      items: shop.items.map((entry) => (entry.tag === invoice.tag ? { ...entry, status: 'available' } : entry)),
      movements: [...shop.movements, { tag: invoice.tag, reason: 'return', ref: invoiceId }],
    },
    `sale.returned:${invoiceId}`,
  )
}

export function intakeOldGold(
  shop: Shop,
  customerId: string,
  cents: Cents,
  detail: { purity: string; grams: string } = { purity: '22K', grams: '0' },
): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'oldgold.denied')
  if (!shop.customers.some((customer) => customer.id === customerId)) throw new DeskError('Unknown customer', shop)
  if (cents <= 0) throw new DeskError('Old-gold value must be above zero', shop)
  return stamp(
    {
      ...shop,
      customers: shop.customers.map((customer) =>
        customer.id === customerId ? { ...customer, oldGoldCents: customer.oldGoldCents + cents } : customer,
      ),
      oldGold: [...shop.oldGold, { id: `OG-${shop.oldGold.length + 1}`, customerId, purity: detail.purity, grams: detail.grams, cents }],
    },
    'oldgold.intake',
  )
}

export function colomboDay(offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (!offset) return today
  const [year, month, day] = today.split('-').map(Number)
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + offset)).toISOString().slice(0, 10)
}

export function repairPace(job: { status: string; receivedOn: string; dueOn: string }, today = colomboDay()) {
  if (job.status === 'closed') return { label: 'Collected', percent: 100, tone: 'ok' as const }
  if (job.dueOn < today) return { label: 'Overdue', percent: 100, tone: 'bad' as const }
  if (job.dueOn === today) return { label: 'Due today', percent: 92, tone: 'wait' as const }
  const start = Date.parse(`${job.receivedOn}T00:00:00Z`)
  const due = Date.parse(`${job.dueOn}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  const span = Math.max(due - start, 1)
  const percent = Math.round(Math.min(88, Math.max(12, ((now - start) / span) * 100)))
  const days = Math.max(1, Math.round((due - now) / 86_400_000))
  return { label: days === 1 ? '1 day to delivery' : `${days} days to delivery`, percent, tone: 'ok' as const }
}

export function openRepair(shop: Shop, estimateCents: Cents, customerId = 'C1', itemLabel = 'Customer piece', dueOn?: string): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'repair.denied')
  if (estimateCents <= 0) throw new DeskError('Estimate must be above zero', shop)
  const receivedOn = colomboDay()
  const due = dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : colomboDay(7)
  if (due < receivedOn) throw new DeskError('Delivery date cannot be before the receive date', shop)
  return stamp(
    {
      ...shop,
      repairs: [
        ...shop.repairs,
        { id: `R-${shop.repairs.length + 1}`, status: 'open', advanceCents: 0, estimateCents, customerId, itemLabel, receivedOn, dueOn: due },
      ],
    },
    'repair.opened',
  )
}

export function takeRepairAdvance(shop: Shop, id: string, cents: Cents): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'repair.denied')
  return stamp(
    {
      ...shop,
      repairs: shop.repairs.map((job) => (job.id === id ? { ...job, advanceCents: job.advanceCents + cents } : job)),
    },
    `repair.advance:${id}`,
  )
}

export function closeRepair(shop: Shop, id: string): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'repair.denied')
  const job = shop.repairs.find((entry) => entry.id === id)
  if (!job || job.status !== 'open') throw new DeskError('Repair is not open', shop)
  return stamp(
    { ...shop, repairs: shop.repairs.map((entry) => (entry.id === id ? { ...entry, status: 'closed' } : entry)) },
    `repair.closed:${id}`,
  )
}

export function proposeAdjustment(shop: Shop, tag: string, after: 'available' | 'sold', reason: string): Shop {
  if (!permits(shop, 'adjustStock')) deny(shop, 'adjust.denied')
  const item = shop.items.find((entry) => entry.tag === tag)
  if (!item) throw new DeskError('Unknown tag', shop)
  return stamp(
    {
      ...shop,
      adjustments: [...shop.adjustments, { id: `ADJ-${shop.adjustments.length + 1}`, tag, before: item.status, after, approved: false, reason }],
    },
    'adjust.proposed',
  )
}

export function approveAdjustment(shop: Shop, id: string): Shop {
  if (!permits(shop, 'approveStockAdjust')) deny(shop, 'adjust.approve_denied')
  const adjustment = shop.adjustments.find((entry) => entry.id === id)
  if (!adjustment || adjustment.approved) throw new DeskError('Nothing to approve', shop)
  return stamp(
    {
      ...shop,
      adjustments: shop.adjustments.map((entry) => (entry.id === id ? { ...entry, approved: true } : entry)),
      items: shop.items.map((item) => (item.tag === adjustment.tag ? { ...item, status: adjustment.after } : item)),
      movements: [...shop.movements, { tag: adjustment.tag, reason: 'approved_adjustment', ref: id }],
    },
    `adjust.approved:${id}`,
  )
}

export function recordExpense(shop: Shop, category: string, cents: Cents): Shop {
  if (!permits(shop, 'viewProfit')) deny(shop, 'expense.denied')
  return stamp({ ...shop, expenses: [...shop.expenses, { id: `EX-${shop.expenses.length + 1}`, category, cents }] }, 'expense.recorded')
}

export function postJournal(shop: Shop, debit: Cents, credit: Cents, source: string): Shop {
  if (!permits(shop, 'viewProfit')) deny(shop, 'journal.denied')
  if (debit !== credit) throw new DeskError('Journal does not balance', shop)
  return stamp({ ...shop, journals: [...shop.journals, { id: `J-${shop.journals.length + 1}`, debit, credit, source }] }, 'journal.posted')
}

export function dispatchTransfer(shop: Shop, tag: string, to: string): Shop {
  if (!permits(shop, 'receiveStock')) deny(shop, 'transfer.denied')
  const item = shop.items.find((entry) => entry.tag === tag)
  if (!item) throw new DeskError('Unknown tag', shop)
  return stamp(
    {
      ...shop,
      transfers: [...shop.transfers, { id: `TR-${shop.transfers.length + 1}`, tag, from: item.branch, to, status: 'dispatched' }],
    },
    'transfer.dispatched',
  )
}

export function receiveTransfer(shop: Shop, id: string): Shop {
  if (!permits(shop, 'receiveStock')) deny(shop, 'transfer.denied')
  const transfer = shop.transfers.find((entry) => entry.id === id)
  if (!transfer || transfer.status !== 'dispatched') throw new DeskError('Transfer is not in transit', shop)
  return stamp(
    {
      ...shop,
      transfers: shop.transfers.map((entry) => (entry.id === id ? { ...entry, status: 'received' } : entry)),
      items: shop.items.map((item) => (item.tag === transfer.tag ? { ...item, branch: transfer.to } : item)),
      movements: [...shop.movements, { tag: transfer.tag, reason: 'transfer_receipt', ref: id }],
    },
    `transfer.received:${id}`,
  )
}

export function paySupplier(shop: Shop, supplierId: string, cents: Cents): Shop {
  if (!permits(shop, 'managePurchases') && !permits(shop, 'viewProfit')) deny(shop, 'supplier.pay_denied')
  const supplier = shop.suppliers.find((entry) => entry.id === supplierId)
  if (!supplier) throw new DeskError('Unknown supplier', shop)
  if (cents <= 0 || cents > supplier.balanceCents) throw new DeskError('Payment does not match the supplier balance', shop)
  return stamp(
    {
      ...shop,
      suppliers: shop.suppliers.map((entry) => (entry.id === supplierId ? { ...entry, balanceCents: entry.balanceCents - cents } : entry)),
    },
    `supplier.paid:${supplierId}`,
  )
}

export function settleCredit(shop: Shop, invoiceId: string, payments: { method: string; cents: Cents }[]): Shop {
  if (!permits(shop, 'posSale')) deny(shop, 'sale.denied')
  const invoice = shop.invoices.find((entry) => entry.id === invoiceId)
  if (!invoice || invoice.status !== 'credit') throw new DeskError('Only a credit invoice can be settled', shop)
  const due = invoice.totalCents - invoice.paidCents
  const add = payments.reduce((sum, payment) => sum + payment.cents, 0)
  if (add <= 0 || add > due) throw new DeskError('Payment does not match the balance', shop)
  const paid = invoice.paidCents + add
  return stamp(
    {
      ...shop,
      invoices: shop.invoices.map((entry) =>
        entry.id === invoiceId
          ? { ...entry, paidCents: paid, status: paid === entry.totalCents ? ('completed' as const) : ('credit' as const), payments: [...entry.payments, ...payments] }
          : entry,
      ),
    },
    `sale.settled:${invoiceId}`,
  )
}

export function openManufacturing(shop: Shop, issuedGrams = '10', labourCents: Cents = 0): Shop {
  if (!permits(shop, 'managePurchases')) deny(shop, 'manufacturing.denied')
  const id = `WO-${shop.manufacturingOrders + 1}`
  return stamp(
    {
      ...shop,
      manufacturingOrders: shop.manufacturingOrders + 1,
      workOrders: [...shop.workOrders, { id, issuedGrams, returnedGrams: '0', labourCents, status: 'open' }],
    },
    'manufacturing.opened',
  )
}

export function closeWorkOrder(shop: Shop, id: string, returnedGrams: string): Shop {
  if (!permits(shop, 'managePurchases')) deny(shop, 'manufacturing.denied')
  const job = shop.workOrders.find((entry) => entry.id === id)
  if (!job || job.status !== 'open') throw new DeskError('Work order is not open', shop)
  return stamp(
    {
      ...shop,
      workOrders: shop.workOrders.map((entry) => (entry.id === id ? { ...entry, returnedGrams, status: 'closed' as const } : entry)),
    },
    `manufacturing.closed:${id}`,
  )
}

export function closeCash(shop: Shop, countedCents: Cents): Shop {
  if (!permits(shop, 'viewPos')) deny(shop, 'cash.denied')
  const completed = shop.invoices.filter((invoice) => invoice.status === 'completed')
  const sumMethod = (method: string) =>
    completed.flatMap((invoice) => invoice.payments).filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.cents, 0)
  return stamp(
    {
      ...shop,
      cashClose: { invoicesCents: sumMethod('cash'), countedCents, cardCents: sumMethod('card'), bankCents: sumMethod('bank_transfer') },
    },
    'cash.closed',
  )
}

export function profitFor(shop: Shop) {
  const sales = shop.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0)
  const returns = shop.invoices.filter((invoice) => invoice.status === 'returned').reduce((sum, invoice) => sum + invoice.totalCents, 0)
  const expenses = shop.expenses.reduce((sum, expense) => sum + expense.cents, 0)
  const cogs = shop.invoices
    .filter((invoice) => invoice.status !== 'returned')
    .reduce((sum, invoice) => sum + (shop.items.find((item) => item.tag === invoice.tag)?.costCents ?? 0), 0)
  return calculateProfit({
    salesCents: sales,
    returnsCents: returns,
    discountsCents: 0,
    cogsCents: cogs,
    operatingExpensesCents: expenses,
    otherIncomeCents: 0,
    otherExpensesCents: 0,
  })
}

export function salesCsv(shop: Shop): string {
  const lines = ['id,status,total', ...shop.invoices.map((invoice) => `${invoice.id},${invoice.status},${invoice.totalCents}`)]
  return lines.join('\n')
}
