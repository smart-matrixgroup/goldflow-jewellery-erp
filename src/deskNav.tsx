import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  Coins,
  Factory,
  Gem,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Desktop nav width. Tailwind `lg` is the same value via `--breakpoint-lg` in index.css.
 * Change that theme variable to move the burger / full-nav switch; this number is only the fallback.
 */
export const DESK_NAV_MIN_PX = 1024

export function deskNavQuery() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-lg').trim()
  return `(min-width: ${raw || `${DESK_NAV_MIN_PX}px`})`
}

export type NavItem = {
  label: string
  path: string
  band: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { band: 'Desk', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { band: 'Vault', label: 'Gold rates', path: '/rates', icon: Coins },
  { band: 'Vault', label: 'Products', path: '/products', icon: Gem },
  { band: 'Vault', label: 'Inventory', path: '/inventory', icon: Warehouse },
  { band: 'Vault', label: 'Suppliers', path: '/purchases', icon: ShoppingBag },
  { band: 'Counter', label: 'POS', path: '/pos', icon: Store },
  { band: 'Counter', label: 'Customers', path: '/customers', icon: Users },
  { band: 'Counter', label: 'Old gold', path: '/old-gold', icon: CircleDollarSign },
  { band: 'Counter', label: 'Repairs', path: '/repairs', icon: Wrench },
  { band: 'Counter', label: 'Returns', path: '/returns', icon: Undo2 },
  { band: 'Workshop', label: 'Manufacturing', path: '/manufacturing', icon: Factory },
  { band: 'Accounts', label: 'Payments', path: '/payments', icon: Wallet },
  { band: 'Accounts', label: 'Accounting', path: '/accounting', icon: BookOpen },
  { band: 'Accounts', label: 'Expenses', path: '/expenses', icon: Receipt },
  { band: 'Accounts', label: 'Reports', path: '/reports', icon: BarChart3 },
  { band: 'House', label: 'Settings', path: '/settings', icon: Settings },
  { band: 'House', label: 'Staff access', path: '/users', icon: UserCog },
]

export function groupNav(items: readonly NavItem[]) {
  const order: string[] = []
  for (const item of items) {
    if (!order.includes(item.band)) order.push(item.band)
  }
  return order.map((label) => ({ label, items: items.filter((item) => item.band === label) }))
}

export function useDeskMenu() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const media = window.matchMedia(deskNavQuery())
    const onChange = () => {
      if (media.matches) setOpen(false)
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return {
    open,
    toggle: () => setOpen((value) => !value),
    close: () => setOpen(false),
  }
}

export function DeskMenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion() === true
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 }
  return (
    <button
      type="button"
      className="desk-burger grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white lg:hidden"
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="desk-menu"
      onClick={onToggle}
    >
      <span className="relative block h-3.5 w-[18px]" aria-hidden="true">
        <motion.span className="absolute top-0 left-0 h-0.5 w-[18px] rounded-full bg-[#12161d]" animate={{ y: open ? 6 : 0, rotate: open ? 45 : 0 }} transition={spring} />
        <motion.span className="absolute top-1.5 left-0 h-0.5 w-[18px] rounded-full bg-[#12161d]" animate={{ opacity: open ? 0 : 1 }} transition={reduce ? { duration: 0 } : { duration: 0.15 }} />
        <motion.span className="absolute top-3 left-0 h-0.5 w-[18px] rounded-full bg-[#12161d]" animate={{ y: open ? -6 : 0, rotate: open ? -45 : 0 }} transition={spring} />
      </span>
    </button>
  )
}

export function DeskMenuDrawer({ open, items, onClose }: { open: boolean; items: readonly NavItem[]; onClose: () => void }) {
  const reduce = useReducedMotion() === true
  const slide = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 }
  return (
    <AnimatePresence>
      {open ? (
        <motion.button
          key="desk-backdrop"
          type="button"
          className="desk-backdrop lg:hidden"
          aria-label="Close menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          onClick={onClose}
        />
      ) : null}
      {open ? (
        <motion.nav
          key="desk-menu"
          id="desk-menu"
          className="desk-drawer lg:hidden"
          aria-label="Sections"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={slide}
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
            }}
          >
            {groupNav(items).map((band) => (
              <div key={band.label}>
                <p className="desk-drawer-band">{band.label}</p>
                {band.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <motion.div
                      key={item.path}
                      variants={{
                        hidden: { opacity: 0, x: -16 },
                        show: { opacity: 1, x: 0, transition: reduce ? { duration: 0 } : { duration: 0.2 } },
                      }}
                    >
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) => `drawer-link${isActive ? ' active' : ''}`}
                        onClick={onClose}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? <motion.span layoutId="drawer-indicator" className="drawer-indicator" transition={slide} /> : null}
                            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                            <span>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </motion.div>
        </motion.nav>
      ) : null}
    </AnimatePresence>
  )
}
