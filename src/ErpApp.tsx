import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  const navRef = useRef<HTMLElement>(null)
  useHoverLight()
  const navigate = useNavigate()

  useEffect(() => {
    if (document.documentElement.dataset.effects === 'off') return
    let frame = 0
    const tick = (now: number) => {
      const turn = now / 1000
      document.querySelectorAll<HTMLElement>('.gate-ring').forEach((ring, index) => {
        const speed = index === 1 ? -110 : 70 + index * 45
        ring.style.transform = `rotate(${turn * speed}deg)`
      })
      document.querySelectorAll<HTMLElement>('.gate-sweep, .brand-orbit').forEach((node) => {
        node.style.transform = `rotate(${turn * 160}deg)`
      })
      document.querySelectorAll<HTMLElement>('.gate-gem, .brand-mark svg').forEach((node) => {
        node.style.transform = `rotate(${turn * 90}deg)`
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

  const reload = useCallback(async () => {
    try {
      const next = await fetchLiveBoard(apiKey)
      setBoard(next)
      setProblem(next.warning)
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'Live rates are unavailable. The approved shop rate is unchanged.')
    }
  }, [apiKey])

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const next = await fetchLiveBoard(apiKey)
        if (!cancel) {
          setBoard(next)
          setProblem(next.warning)
        }
      } catch (caught) {
        if (!cancel) setProblem(caught instanceof Error ? caught.message : 'Live rates are unavailable. The approved shop rate is unchanged.')
      }
    })()
    const timer = window.setInterval(() => void reload(), 60_000)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [apiKey, reload])

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
    <div className="h-svh overflow-hidden bg-paper text-ink md:grid md:grid-cols-[248px_1fr]">
      <aside className="erp-side hidden h-svh min-h-0 flex-col md:flex">
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
          {navBands(menu).map((band) => (
            <div key={band.label}>
              <p className="erp-band">{band.label}</p>
              {band.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `erp-link ${isActive ? 'active' : ''}`}>
                  <NavGlyph path={link.to} />
                  <span className="truncate">{link.title.split(' & ')[0]}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto shrink-0 border-t border-line px-4 py-3">
          <p className="text-xs text-gold">GoldFlow Jewellery ERP</p>
          <p className="mt-1 text-[10px] tracking-[0.18em] text-muted uppercase">Manage · Track · Grow</p>
        </div>
      </aside>
      <div className="erp-stage flex h-svh min-w-0 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
          {menu.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `erp-link shrink-0 ${isActive ? 'active' : ''}`}>
              {link.title.split(' & ')[0]}
            </NavLink>
          ))}
        </div>
        <header className="bg-header z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 backdrop-blur">
          <form
            className="relative mx-auto w-full max-w-xl"
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
          <button type="button" className="desk-bell relative grid h-10 w-10 place-items-center rounded-full border border-line text-gold" aria-label="Notifications" onClick={() => setAlertsOpen((open) => !open)}>
            <Bell />
            {alerts.length > 0 ? <span className="desk-badge bg-accent text-on-accent absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold">{alerts.length}</span> : null}
          </button>
          {alertsOpen ? (
            <div className="lux-card absolute top-16 right-28 z-30 w-80 p-4 text-sm">
              {alerts.length === 0 ? <p className="text-muted">Nothing is waiting.</p> : alerts.map((alert) => <p key={alert} className="border-b border-line py-2 last:border-0">{alert}</p>)}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="mark grid h-10 w-10 place-items-center rounded-full text-sm font-semibold">{person?.name.slice(0, 1).toUpperCase()}</span>
            <span className="hidden text-right sm:block">
              <span className="block text-sm">{person?.name}</span>
              <span className="block text-[10px] text-muted capitalize">{person?.role === 'owner' ? 'Admin' : person?.role}</span>
            </span>
          </div>
          <button type="button" className="text-xs text-muted" onClick={() => { setSession(null); sessionStorage.removeItem(sessionName) }}>Sign out</button>
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
    </div>
  )
}

function navBands(menu: ReturnType<typeof visibleModules>) {
  const order = [
    ['Desk', ['/']],
    ['Vault', ['/rates', '/products', '/inventory', '/purchases']],
    ['Counter', ['/pos', '/customers', '/old-gold', '/repairs', '/returns']],
    ['Workshop', ['/manufacturing']],
    ['Accounts', ['/payments', '/accounting', '/expenses', '/reports']],
    ['House', ['/settings', '/users']],
  ] as const
  return order
    .map(([label, paths]) => ({ label, links: paths.flatMap((path) => menu.filter((item) => item.to === path)) }))
    .filter((band) => band.links.length > 0)
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

function NavGlyph({ path }: { path: string }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const bar = { ...stroke, className: 'nav-bar' }
  const kind = path === '/' ? 'home' : path.slice(1)
  return (
    <span className="nav-mark">
      <svg className={`nav-ico nav-ico-${kind}`} viewBox="0 0 24 24" aria-hidden="true">
        {path === '/' ? <path {...stroke} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z" /> : null}
        {path === '/rates' ? <><path {...bar} d="M4 19V9" /><path {...bar} d="M9 19V5" /><path {...bar} d="M14 19v-7" /><path {...bar} d="M19 19V8" /><path {...stroke} d="M3 19h18" /></> : null}
        {path === '/products' ? <><path {...stroke} d="M12 3.5 19 7l-7 3.5L5 7z" /><path {...stroke} d="M5 7v6.2L12 16.5l7-3.3V7" /><path {...stroke} d="M12 10.5V16.5" /></> : null}
        {path === '/inventory' ? <><path {...stroke} d="M4 8h16v11H4z" /><path {...stroke} d="M8 8V6.2A1.2 1.2 0 0 1 9.2 5h5.6A1.2 1.2 0 0 1 16 6.2V8" /><path {...stroke} d="M4 12h16" /></> : null}
        {path === '/purchases' ? <><path {...stroke} d="M6 7h12l-1.2 11H7.2z" /><path {...stroke} d="M9 7 10 4h4l1 3" /><path {...stroke} d="M9 11h6" /></> : null}
        {path === '/pos' ? <><rect {...stroke} x="4" y="4" width="16" height="12" rx="2" /><path {...stroke} d="M8 20h8M12 16v4" /></> : null}
        {path === '/customers' ? <><circle {...stroke} cx="9" cy="8" r="2.4" /><circle {...stroke} cx="16.5" cy="9" r="1.8" /><path {...stroke} d="M4.2 18.5c.7-2.4 2.4-3.6 4.8-3.6s4.1 1.2 4.8 3.6M14 15.2c1.1-1.1 2.3-1.6 3.6-1.6 1.4 0 2.5.6 3.2 1.8" /></> : null}
        {path === '/old-gold' ? <><circle {...stroke} cx="12" cy="12" r="8" /><path {...stroke} d="M12 7.5v9M9.2 9.4h4.1a2.2 2.2 0 0 1 0 4.4H9.8" /></> : null}
        {path === '/repairs' ? <><path {...stroke} d="M14.5 5.5 18.5 9.5 9.2 18.8H5.2v-4z" /><path {...stroke} d="M13 7 17 11" /></> : null}
        {path === '/manufacturing' ? <><path {...stroke} d="M4 19h16" /><path {...stroke} d="M6 19V9.2L12 5l6 4.2V19" /><path {...stroke} d="M10 19v-4h4v4" /></> : null}
        {path === '/payments' ? <><rect {...stroke} x="3" y="6" width="18" height="12" rx="2" /><path {...stroke} d="M3 10h18M7 14h4" /></> : null}
        {path === '/accounting' ? <><path {...stroke} d="M7 3.5h7.2L18 7.2V20H7z" /><path {...stroke} d="M14 3.5V7.2H18" /><path {...stroke} d="M10 12h5M10 15.5h5" /></> : null}
        {path === '/expenses' ? <><path {...stroke} d="M5 19V6.2A1.2 1.2 0 0 1 6.2 5H10l1.6 2.2H18a1 1 0 0 1 1 1V19z" /><path {...stroke} d="M8 12h7M8 15.5h4" /></> : null}
        {path === '/returns' ? <><path {...stroke} d="M20 12a8 8 0 1 1-2.2-5.5" /><path {...stroke} d="M20 4.5V9h-4.5" /></> : null}
        {path === '/reports' ? <><path {...bar} d="M5 19V11" /><path {...bar} d="M12 19V5" /><path {...bar} d="M19 19v-6" /><path {...stroke} d="M3.5 19h17" /></> : null}
        {path === '/settings' ? <><circle {...stroke} cx="12" cy="12" r="3" /><path {...stroke} d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></> : null}
        {path === '/users' ? <><circle {...stroke} cx="12" cy="8" r="2.6" /><path {...stroke} d="M6.2 19c.8-2.8 2.8-4.2 5.8-4.2s5 1.4 5.8 4.2" /></> : null}
      </svg>
    </span>
  )
}
