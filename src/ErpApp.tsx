import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { moduleOpen, visibleModules } from './access.ts'
import { loadBooks, saveBooks } from './books.ts'
import { DeskError, type DeskAccount, type Shop } from './desk.ts'
import { useHoverLight } from './ambient.tsx'
import { Dashboard } from './dashboard.tsx'
import { fetchLiveBoard, type LiveBoard } from './liveGold.ts'
import { Pos } from './pos.tsx'
import {
  Accounting,
  Audit,
  Customers,
  Expenses,
  Inventory,
  Manufacturing,
  OldGold,
  Payments,
  Products,
  Purchases,
  Rates,
  Repairs,
  Reports,
  Returns,
  Users,
  type Run,
} from './pages.tsx'
import { Settings } from './settings.tsx'
import { applyChoice, readChoice } from './theme.ts'
import { DeskMenuButton, DeskMenuDrawer, groupNav, NAV_ITEMS, useDeskMenu } from './deskNav.tsx'

const keyName = 'goldflow.goldApiKey'
const sessionName = 'goldflow.erp.session'

function storedKey() {
  try {
    return sessionStorage.getItem(keyName) ?? ''
  } catch {
    return ''
  }
}

function storedToken() {
  try {
    return sessionStorage.getItem(sessionName)
  } catch {
    return null
  }
}

function accountFromToken(shop: Shop, token: string | null) {
  if (!token) return null
  return shop.accounts.find((account) => account.id === token) ?? shop.accounts.find((account) => account.role === token) ?? null
}

function readBoot() {
  const loaded = loadBooks()
  const account = accountFromToken(loaded, storedToken())
  if (account) {
    try {
      sessionStorage.setItem(sessionName, account.id)
    } catch {
      /* the account still applies for this view */
    }
  }
  return {
    session: account?.id ?? null,
    desk: account ? { ...loaded, role: account.role, accountId: account.id } : loaded,
  }
}

export function ErpApp() {
  const [boot] = useState(readBoot)
  const [session, setSession] = useState<string | null>(boot.session)
  const [desk, setDesk] = useState<Shop>(boot.desk)
  const [error, setError] = useState<string | null>(null)
  const [apiKey] = useState(storedKey)
  const [board, setBoard] = useState<LiveBoard | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [email, setEmail] = useState(boot.desk.accounts[0]?.email ?? '')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [alertsOpen, setAlertsOpen] = useState(false)
  const location = useLocation()
  const menuUi = useDeskMenu()
  const navRef = useRef<HTMLElement>(null)
  useHoverLight()
  const navigate = useNavigate()

  useEffect(() => {
    if (document.documentElement.dataset.effects === 'off') return
    let frame = 0
    const tick = (now: number) => {
      const turn = now / 1000
      document.querySelectorAll<HTMLElement>('.gate-ring').forEach((ring, index) => {
        const speed = index === 1 ? -8 : 10 + index * 4
        ring.style.transform = `rotate(${turn * speed}deg)`
      })
      document.querySelectorAll<HTMLElement>('.gate-sweep, .brand-orbit').forEach((node) => {
        node.style.transform = `rotate(${turn * 8}deg)`
      })
      document.querySelectorAll<HTMLElement>('.gate-gem, .brand-mark svg').forEach((node) => {
        node.style.transform = `rotate(${turn * 12}deg)`
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [session])

  useEffect(() => {
    const nav = navRef.current
    const pill = nav?.querySelector<HTMLElement>('.nav-pill')
    if (!nav || !pill) return
    const place = (link: HTMLElement) => {
      pill.style.transform = `translateY(${link.offsetTop}px)`
      pill.style.height = `${link.offsetHeight}px`
    }
    const current = () => nav.querySelector<HTMLElement>('.erp-link.active')
    const home = () => {
      const link = current()
      if (link) place(link)
    }
    const onPoint = (event: Event) => place(event.currentTarget as HTMLElement)
    const links = [...nav.querySelectorAll<HTMLElement>('.erp-link')]
    for (const link of links) {
      link.addEventListener('mouseenter', onPoint)
      link.addEventListener('focus', onPoint)
    }
    nav.addEventListener('mouseleave', home)
    window.addEventListener('resize', home)
    home()
    return () => {
      for (const link of links) {
        link.removeEventListener('mouseenter', onPoint)
        link.removeEventListener('focus', onPoint)
      }
      nav.removeEventListener('mouseleave', home)
      window.removeEventListener('resize', home)
    }
  }, [location.pathname, session])

  useEffect(() => {
    saveBooks(desk)
  }, [desk])

  useEffect(() => {
    const choice = readChoice(desk.accountId ?? null)
    applyChoice(choice)
    if (choice.mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyChoice(readChoice(desk.accountId ?? null))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [desk.accountId])

  useEffect(() => {
    let cancel = false
    let timer = 0
    let misses = 0
    const load = async () => {
      try {
        const next = await fetchLiveBoard(apiKey)
        if (cancel) return
        misses = 0
        setBoard(next)
        setProblem(next.warning)
        timer = window.setTimeout(() => void load(), 60_000)
      } catch (caught) {
        if (cancel) return
        misses += 1
        setProblem(caught instanceof Error ? caught.message : 'Live rates are unavailable. The approved shop rate is unchanged.')
        timer = window.setTimeout(() => void load(), misses < 3 ? 5_000 : 60_000)
      }
    }
    void load()
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [apiKey])

  const run: Run = (action) => {
    setError(null)
    setDesk((current) => {
      try {
        return action(current)
      } catch (caught) {
        if (caught instanceof DeskError) {
          setError(caught.message)
          return caught.shop
        }
        setError(caught instanceof Error ? caught.message : 'The action failed')
        return current
      }
    })
  }

  function choose(account: DeskAccount) {
    setError(null)
    setSession(account.id)
    setDesk((current) => ({ ...current, role: account.role, accountId: account.id }))
    try {
      sessionStorage.setItem(sessionName, account.id)
    } catch {
      /* the account still applies for this view */
    }
  }

  const menu = visibleModules(desk)
  const navItems = NAV_ITEMS.filter((item) => menu.some((entry) => entry.to === item.path))
  const alerts = useMemo(() => {
    const rows: string[] = []
    if (moduleOpen(desk, '/rates') && desk.rates.some((rate) => rate.status === 'pending_approval')) rows.push('Gold rate waiting for approval')
    if (moduleOpen(desk, '/inventory') && desk.adjustments.some((entry) => !entry.approved)) rows.push('Stock adjustment waiting for approval')
    if (moduleOpen(desk, '/repairs')) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      for (const job of desk.repairs) {
        if (job.status !== 'open') continue
        if (job.dueOn < today) rows.push(`${job.id} · ${job.itemLabel} is past the delivery date`)
        else if (job.dueOn === today) rows.push(`${job.id} · ${job.itemLabel} is due for delivery today`)
      }
    }
    if (moduleOpen(desk, '/purchases') && desk.suppliers.some((supplier) => supplier.balanceCents > 0)) rows.push('Supplier balance unpaid')
    if (moduleOpen(desk, '/payments') && desk.invoices.some((invoice) => invoice.status === 'credit')) rows.push('Customer balance unpaid')
    if (problem) rows.push(problem)
    return rows
  }, [desk, problem])

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []
    const rows: { label: string; to: string }[] = []
    for (const item of desk.items) {
      if (`${item.tag} ${item.name}`.toLowerCase().includes(needle)) rows.push({ label: `${item.tag} · ${item.name}`, to: '/products' })
    }
    for (const invoice of desk.invoices) {
      if (invoice.id.toLowerCase().includes(needle)) rows.push({ label: `${invoice.id} · ${invoice.tag}`, to: '/reports' })
    }
    for (const customer of desk.customers) {
      if (customer.name.toLowerCase().includes(needle)) rows.push({ label: customer.name, to: '/customers' })
    }
    for (const supplier of desk.suppliers) {
      if (supplier.name.toLowerCase().includes(needle)) rows.push({ label: supplier.name, to: '/purchases' })
    }
    return rows.filter((row) => moduleOpen(desk, row.to)).slice(0, 8)
  }, [desk, query])

  if (!session) {
    return (
      <main className="gate">
        <div className="gate-sky" aria-hidden="true">
          <span className="gate-orb gate-orb-a" />
          <span className="gate-orb gate-orb-b" />
          <span className="gate-dust" />
          <span className="gate-dust" />
          <span className="gate-dust" />
          <span className="gate-dust" />
          <span className="gate-dust" />
          <span className="gate-dust" />
        </div>
        <section className="gate-story">
          <div className="gate-orbit" aria-hidden="true">
            <span className="gate-sweep" />
            <span className="gate-ring gate-ring-a"><i /></span>
            <span className="gate-ring gate-ring-b"><i /></span>
            <span className="gate-ring gate-ring-c"><i /></span>
            <span className="gate-core">
              <svg className="gate-gem" viewBox="0 0 64 64">
                <defs>
                  <linearGradient id="gate-gold" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#99f6e4" />
                    <stop offset="0.42" stopColor="#0f766e" />
                    <stop offset="1" stopColor="#8a6a24" />
                  </linearGradient>
                </defs>
                <path fill="url(#gate-gold)" d="M32 4 54 24 32 60 10 24Z" />
                <path fill="none" stroke="#fde68a" strokeWidth="1.4" d="M10 24h44M22 24 32 60 42 24" />
              </svg>
            </span>
          </div>
          <p className="gate-word">GoldFlow</p>
          <p className="gate-kicker">Jewellery desk</p>
          <h1>Every piece, from the case to the bill.</h1>
          <p className="gate-lead">The till, the tagged stock, the repairs, and the approved selling rate live on this desk.</p>
          <ul className="gate-points">
            <li><span className="gate-ico gate-ico-till" aria-hidden="true" /><span><b>Till</b>Scan a tag and take the bill</span></li>
            <li><span className="gate-ico gate-ico-stock" aria-hidden="true" /><span><b>Stock</b>Each piece keeps its tag</span></li>
            <li><span className="gate-ico gate-ico-repair" aria-hidden="true" /><span><b>Repairs</b>Due dates stay in view</span></li>
            <li><span className="gate-ico gate-ico-rate" aria-hidden="true" /><span><b>Rates</b>The till sells on the approved rate</span></li>
          </ul>
        </section>
        <section className="gate-panel">
          <form
            className="gate-card"
            onSubmit={(event) => {
              event.preventDefault()
              const person = desk.accounts.find((entry) => entry.email === email)
              if (!person || person.password !== password) {
                setLoginError('That email or password does not match a desk account.')
                return
              }
              setLoginError(null)
              choose(person)
            }}
          >
            <span className="gate-avatar" aria-hidden="true" />
            <h2>Welcome back</h2>
            <p className="gate-note">Sign in with a desk account.</p>
            <label className="gate-field">
              Desk account
              <select value={email} onChange={(event) => setEmail(event.target.value)}>
                {desk.accounts.map((person) => <option key={person.id} value={person.email}>{person.name} · {person.email}</option>)}
              </select>
            </label>
            <label className="gate-field">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            {loginError ? <p className="gate-error" role="alert">{loginError}</p> : null}
            <button type="submit" className="gate-submit">Sign in</button>
            <p className="gate-hint">Demo passwords are the role names: owner, manager, cashier, accountant, store.</p>
          </form>
        </section>
      </main>
    )
  }

  const person = desk.accounts.find((entry) => entry.id === session)
  const till = location.pathname === '/pos'
  function allow(path: string, element: ReactNode) {
    return moduleOpen(desk, path) ? element : <Navigate to="/" replace />
  }

  if (till && moduleOpen(desk, '/pos')) {
    return <Pos desk={desk} run={run} board={board} cashier={person?.name ?? 'Cashier'} onClose={() => navigate('/')} />
  }

  return (
    <div className={`h-svh overflow-hidden bg-paper text-ink lg:grid lg:grid-cols-[248px_1fr] ${menuUi.open ? 'menu-open' : ''}`}>
      <aside className="erp-side hidden h-svh min-h-0 flex-col lg:flex">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-2">
          <span className="mark brand-mark grid h-10 w-10 place-items-center rounded-xl">
            <span className="brand-orbit" aria-hidden="true" />
            <Diamond />
          </span>
          <span>
            <span className="brand-name block font-serif text-xl leading-none">GoldFlow</span>
            <span className="mt-1 block text-[10px] tracking-[0.22em] text-muted">JEWELLERY ERP</span>
          </span>
        </div>
        <nav ref={navRef} className="erp-nav">
          <span className="nav-pill" aria-hidden="true" />
          {groupNav(navItems).map((band) => (
            <div key={band.label}>
              <p className="erp-band">{band.label}</p>
              {band.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `erp-link ${isActive ? 'active' : ''}`}>
                    <span className="nav-mark"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto shrink-0 border-t border-line px-4 py-3">
          <p className="text-xs text-gold">GoldFlow Jewellery ERP</p>
          <p className="mt-1 text-[10px] tracking-[0.18em] text-muted uppercase">Manage · Track · Grow</p>
        </div>
      </aside>
      <div className="erp-stage flex h-svh min-w-0 flex-col">
        <header className="erp-topbar bg-header z-20 flex shrink-0 items-center gap-2 border-b border-line px-3 backdrop-blur sm:gap-3 sm:px-4">
          <DeskMenuButton open={menuUi.open} onToggle={menuUi.toggle} />
          <form
            className="relative mx-auto min-w-0 w-full max-w-xl flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              const first = hits[0]
              if (first) {
                navigate(first.to)
                setQuery('')
              }
            }}
          >
            <input
              className="desk-search h-10 rounded-full border border-line bg-field pr-4 pl-10 text-sm"
              placeholder="Search invoice, tag, customer, supplier"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search the books"
            />
            <span className="pointer-events-none absolute top-2.5 left-3 text-gold"><SearchMark /></span>
            {hits.length > 0 ? (
              <ul className="lux-card absolute top-12 z-30 w-full p-1 text-sm">
                {hits.map((hit) => (
                  <li key={hit.label}>
                    <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-ink/5" onClick={() => { navigate(hit.to); setQuery('') }}>{hit.label}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
          <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-muted lg:inline-flex">Ward Place</span>
          <button type="button" className="desk-bell relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-gold" aria-label="Notifications" onClick={() => setAlertsOpen((open) => !open)}>
            <Bell />
            {alerts.length > 0 ? <span className="desk-badge bg-accent text-on-accent absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold">{alerts.length}</span> : null}
          </button>
          {alertsOpen ? (
            <div className="lux-card absolute top-16 right-28 z-30 w-80 p-4 text-sm">
              {alerts.length === 0 ? <p className="text-muted">Nothing is waiting.</p> : alerts.map((alert) => <p key={alert} className="border-b border-line py-2 last:border-0">{alert}</p>)}
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
            <span className="mark grid h-10 w-10 place-items-center rounded-full text-sm font-semibold">{person?.name.slice(0, 1).toUpperCase()}</span>
            <span className="hidden text-right sm:block">
              <span className="block text-sm">{person?.name}</span>
              <span className="block text-[10px] text-muted capitalize">{person?.role === 'owner' ? 'Admin' : person?.role}</span>
            </span>
          </div>
          <button type="button" className="shrink-0 text-xs text-muted" onClick={() => { setSession(null); sessionStorage.removeItem(sessionName) }}>Sign out</button>
        </header>
        <main className={till ? 'min-h-0 flex-1 overflow-auto p-4' : 'min-h-0 flex-1 overflow-auto p-4'}>
          {error ? <p className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
          <Routes>
            <Route
              path="/"
              element={<Dashboard desk={desk} board={board} />}
            />
            <Route path="/pos" element={allow('/pos', <Pos desk={desk} run={run} board={board} cashier={person?.name ?? 'Cashier'} onClose={() => navigate('/')} />)} />
            <Route
              path="/rates"
              element={allow('/rates', (
                <Rates
                  desk={desk}
                  run={run}
                  board={board}
                  problem={problem}
                />
              ))}
            />
            <Route path="/products" element={allow('/products', <Products desk={desk} run={run} />)} />
            <Route path="/inventory" element={allow('/inventory', <Inventory desk={desk} run={run} />)} />
            <Route path="/purchases" element={allow('/purchases', <Purchases desk={desk} run={run} />)} />
            <Route path="/customers" element={allow('/customers', <Customers desk={desk} run={run} />)} />
            <Route path="/old-gold" element={allow('/old-gold', <OldGold desk={desk} run={run} />)} />
            <Route path="/repairs" element={allow('/repairs', <Repairs desk={desk} run={run} />)} />
            <Route path="/manufacturing" element={allow('/manufacturing', <Manufacturing desk={desk} run={run} />)} />
            <Route path="/payments" element={allow('/payments', <Payments desk={desk} run={run} />)} />
            <Route path="/accounting" element={allow('/accounting', <Accounting desk={desk} run={run} />)} />
            <Route path="/expenses" element={allow('/expenses', <Expenses desk={desk} run={run} />)} />
            <Route path="/returns" element={allow('/returns', <Returns desk={desk} run={run} />)} />
            <Route path="/reports" element={allow('/reports', <Reports desk={desk} />)} />
            <Route path="/audit" element={allow('/reports', <Audit desk={desk} />)} />
            <Route path="/users" element={allow('/users', <Users desk={desk} run={run} />)} />
            <Route path="/settings" element={allow('/settings', <Settings desk={desk} onReplace={setDesk} />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <DeskMenuDrawer open={menuUi.open} items={navItems} onClose={menuUi.close} />
    </div>
  )
}

function Diamond() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 9h18L12 21 3 9zM3 9l4-5h10l4 5M8 9l4 12 4-12" />
    </svg>
  )
}

function SearchMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function Bell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7zM10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}
