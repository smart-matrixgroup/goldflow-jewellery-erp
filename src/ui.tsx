import type { ReactNode } from 'react'
import { formatLkr, lkrToCents, type Cents } from '@goldflow/shared'

export function money(cents: Cents) {
  return formatLkr(cents)
}

export function rupees(value: string): Cents {
  const trimmed = value.trim()
  if (!trimmed) return 0
  return lkrToCents(trimmed)
}

export const inputClass = 'h-10 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink'

export function Screen({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <header className="border-b border-line pb-3">
        <p className="text-[11px] tracking-[0.22em] text-gold uppercase">GoldFlow desk</p>
        <h1 className="mt-1 font-serif text-3xl text-ink">{title}</h1>
        {note ? <p className="text-muted mt-2 max-w-3xl text-sm leading-6">{note}</p> : null}
      </header>
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lux-card px-4 py-3">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="text-faint mt-1 text-xs">{hint}</p> : null}
    </div>
  )
}

export function Panel({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <section className="lux-card">
      {title ? <h2 className="border-b border-line px-4 py-3 font-serif text-lg">{title}</h2> : null}
      <div className={`p-4 ${className}`}>{children}</div>
    </section>
  )
}

export function Btn({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn-accent h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-40 ${className}`} {...props}>
      {children}
    </button>
  )
}

export function BtnQuiet({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`h-10 rounded-xl border border-gold/35 bg-transparent px-4 text-sm text-gold disabled:opacity-40 ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-muted grid gap-1 text-xs">
      {label}
      {children}
    </label>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'ok' | 'wait' | 'bad' | 'neutral' }) {
  const toneClass = {
    ok: 'tone-ok',
    wait: 'tone-wait',
    bad: 'tone-bad',
    neutral: 'tone-neutral',
  }[tone]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

export function DataTable({ columns, children, plain = false, title }: { columns: string[]; children: ReactNode; plain?: boolean; title?: string }) {
  return (
    <div className={plain ? 'overflow-auto' : 'lux-card overflow-hidden'}>
      {title ? <h2 className="border-b border-line px-4 py-3 font-serif text-lg">{title}</h2> : null}
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-raised text-[11px] tracking-[0.14em] text-gold/80 uppercase">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
}
