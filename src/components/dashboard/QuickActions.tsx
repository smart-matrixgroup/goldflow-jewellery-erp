import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { moduleOpen } from '../../access.ts'
import type { Shop } from '../../desk.ts'

type Action = {
  key: string
  to: string
  title: string
  note: string
  primary?: boolean
  icon: 'sale' | 'gold' | 'repair' | 'stock' | 'rate'
}

/**
 * Tiles only link to pages the desk already has.
 * Add stock opens the jewellery master when that module is open, otherwise the stock page.
 */
function actionsFor(desk: Shop): Action[] {
  const stock = moduleOpen(desk, '/products')
    ? { to: '/products', note: 'Tag a new piece' }
    : moduleOpen(desk, '/inventory')
      ? { to: '/inventory', note: 'Count or move stock' }
      : null
  const all: (Action | null)[] = [
    { key: 'n', to: '/pos', title: 'New sale', note: 'Open the till', primary: true, icon: 'sale' },
    { key: 'o', to: '/old-gold', title: 'Old gold', note: 'Take an exchange', icon: 'gold' },
    { key: 'r', to: '/repairs', title: 'New repair', note: 'Book a job', icon: 'repair' },
    stock ? { key: 's', to: stock.to, title: 'Add stock', note: stock.note, icon: 'stock' } : null,
    { key: 'g', to: '/rates', title: 'Update gold rate', note: 'File today’s rate', icon: 'rate' },
  ]
  return all.filter((action): action is Action => action !== null && moduleOpen(desk, action.to))
}

function motionOff() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'off'
}

function finePointer() {
  return window.matchMedia('(hover: hover)').matches && window.matchMedia('(pointer: fine)').matches
}

export function QuickActions({ desk }: { desk: Shop }) {
  const root = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const actions = useMemo(() => actionsFor(desk), [desk])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      const action = actions.find((entry) => entry.key === event.key.toLowerCase())
      if (!action) return
      event.preventDefault()
      navigate(action.to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, navigate])

  useEffect(() => {
    const node = root.current
    if (!node || motionOff() || !finePointer()) return
    let raf = 0
    let px = 0
    let py = 0
    // Spotlight follows the cursor through CSS variables. No React render on move.
    const apply = () => {
      raf = 0
      const tile = node.querySelector<HTMLElement>('.qa-tile:hover')
      if (!tile) return
      const rect = tile.getBoundingClientRect()
      tile.style.setProperty('--mx', `${((px - rect.left) / rect.width * 100).toFixed(1)}%`)
      tile.style.setProperty('--my', `${((py - rect.top) / rect.height * 100).toFixed(1)}%`)
    }
    const onMove = (event: PointerEvent) => {
      px = event.clientX
      py = event.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = (event: Event) => {
      const tile = event.currentTarget as HTMLElement
      tile.style.setProperty('--mx', '50%')
      tile.style.setProperty('--my', '30%')
    }
    const tiles = [...node.querySelectorAll<HTMLElement>('.qa-tile')]
    for (const tile of tiles) tile.addEventListener('pointerleave', onLeave)
    node.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      node.removeEventListener('pointermove', onMove)
      for (const tile of tiles) tile.removeEventListener('pointerleave', onLeave)
    }
  }, [actions])

  if (actions.length === 0) return null
  return (
    <section ref={root} className="qa" aria-label="Quick actions">
      <h2>Quick actions</h2>
      <div className="qa-row">
        {actions.map((action) => (
          <Link key={action.key} className={`qa-tile ${action.primary ? 'primary' : ''}`} to={action.to} aria-keyshortcuts={action.key.toUpperCase()}>
            <span className="qa-ico" aria-hidden="true"><ActionIcon kind={action.icon} /></span>
            <span className="qa-copy">
              <span className="qa-title">{action.title}</span>
              <span className="qa-sub">{action.note}</span>
            </span>
            <kbd className="qa-key">{action.key.toUpperCase()}</kbd>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ActionIcon({ kind }: { kind: Action['icon'] }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'sale') return <svg width="22" height="22" viewBox="0 0 24 24"><path {...stroke} d="M6 7h12l-1 13H7L6 7z" /><path {...stroke} d="M9 7a3 3 0 0 1 6 0" /></svg>
  if (kind === 'gold') return <svg width="22" height="22" viewBox="0 0 24 24"><circle {...stroke} cx="12" cy="12" r="8" /><path {...stroke} d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" /></svg>
  if (kind === 'repair') return <svg width="22" height="22" viewBox="0 0 24 24"><path {...stroke} d="M14 7a4 4 0 0 0-5 5L4 17l3 3 5-5a4 4 0 0 0 5-5l-3 3-2-2 2-3z" /></svg>
  if (kind === 'stock') return <svg width="22" height="22" viewBox="0 0 24 24"><path {...stroke} d="M12 3 21 8v8l-9 5-9-5V8z" /><path {...stroke} d="M12 12V8M10 10h4" /></svg>
  return <svg width="22" height="22" viewBox="0 0 24 24"><path {...stroke} d="M4 16l5-5 3 3 7-8" /><path {...stroke} d="M14 6h6v6" /></svg>
}
