import { capabilities, type Capability } from '@goldflow/shared'
import { permits, type Shop } from './desk.ts'

export const modules: { index: string; to: string; title: string; any: Capability[] }[] = [
  { index: '01', to: '/', title: 'Dashboard & overview', any: [] },
  { index: '02', to: '/rates', title: 'Gold rates & purity', any: [capabilities.editGoldRates, capabilities.approveGoldRates] },
  { index: '03', to: '/products', title: 'Products & jewellery', any: [capabilities.countStock, capabilities.receiveStock, capabilities.viewPurchases, capabilities.managePurchases] },
  { index: '04', to: '/inventory', title: 'Inventory & stock', any: [capabilities.countStock, capabilities.adjustStock, capabilities.receiveStock, capabilities.approveStockAdjust] },
  { index: '05', to: '/purchases', title: 'Suppliers & purchases', any: [capabilities.viewPurchases, capabilities.managePurchases, capabilities.receiveStock] },
  { index: '06', to: '/pos', title: 'POS & sales', any: [capabilities.posSale] },
  { index: '07', to: '/customers', title: 'Customers & CRM', any: [capabilities.posSale] },
  { index: '08', to: '/old-gold', title: 'Old gold & exchange', any: [capabilities.posSale] },
  { index: '09', to: '/repairs', title: 'Repairs & custom jobs', any: [capabilities.posSale] },
  { index: '10', to: '/manufacturing', title: 'Manufacturing & karigar', any: [capabilities.managePurchases] },
  { index: '11', to: '/payments', title: 'Payments & cash', any: [capabilities.viewPos, capabilities.viewProfit] },
  { index: '12', to: '/accounting', title: 'Accounting & ledgers', any: [capabilities.viewProfit, capabilities.viewLimitedProfit] },
  { index: '13', to: '/expenses', title: 'Expenses & profit', any: [capabilities.viewProfit] },
  { index: '14', to: '/returns', title: 'Returns & warranty', any: [capabilities.posSale] },
  { index: '15', to: '/reports', title: 'Reports & audit', any: [capabilities.viewAudit, capabilities.viewProfit, capabilities.viewLimitedProfit] },
  { index: '16', to: '/settings', title: 'Settings & administration', any: [capabilities.manageSettings] },
  { index: '17', to: '/users', title: 'Staff access', any: [capabilities.manageUsers] },
]

export const optionLabel: Record<Capability, string> = {
  editGoldRates: 'File gold rates',
  approveGoldRates: 'Approve gold rates',
  posSale: 'Sell at the till',
  viewPos: 'Read the till and the drawer',
  discountBeyondThreshold: 'Discount past the limit',
  receiveStock: 'Receive stock',
  countStock: 'Count stock',
  adjustStock: 'Propose a stock adjustment',
  approveStockAdjust: 'Approve a stock adjustment',
  managePurchases: 'Draft purchases and workshop orders',
  addProducts: 'Add products',
  viewPurchases: 'Read supplier purchases',
  viewProfit: 'See profit, expenses and journals',
  viewLimitedProfit: 'See a limited profit view',
  manageUsers: 'Approve staff options',
  viewAudit: 'Read the audit log',
  manageSettings: 'Change settings and backups',
}

export function moduleOpen(shop: Shop, path: string) {
  const entry = modules.find((module) => module.to === path)
  if (!entry) return false
  if (entry.any.length === 0) return true
  return entry.any.some((capability) => permits(shop, capability))
}

export function visibleModules(shop: Shop) {
  return modules.filter((module) => moduleOpen(shop, module.to))
}
