import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paletteFor, themePresets, type ThemeMode, type ThemePresetId } from '@goldflow/ui-tokens'
import { emptyBooks, loadBooks } from './books.ts'
import { permits, type Shop } from './desk.ts'
import { accentOnDesk, applyChoice, clearUserChoice, readChoice, resolvedMode, saveTenantChoice, saveUserChoice, type ThemeChoice } from './theme.ts'
import { Btn, BtnQuiet, Panel, Screen } from './ui.tsx'

export function Settings({ desk, onReplace }: { desk: Shop; onReplace: (shop: Shop) => void }) {
  const [note, setNote] = useState<string | null>(null)

  function download() {
    const blob = new Blob([JSON.stringify(desk, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'goldflow-books-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    setNote('Backup file downloaded. Keep it outside this browser.')
  }

  function restore(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        localStorage.setItem('goldflow.erp.books.v1', String(reader.result))
        onReplace(loadBooks())
        setNote('Backup restored. Stock, invoices and rates were replaced from that file.')
      } catch {
        setNote('That file could not be read as a books backup.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Screen title="Settings and administration" note="These books are stored in this browser as structured records. Export a backup before clearing them. A restore replaces the current books.">
      {note ? <p className="note-banner rounded-lg px-3 py-2 text-sm">{note}</p> : null}
      <Appearance key={desk.accountId ?? 'desk'} accountId={desk.accountId ?? null} canSetHouse={permits(desk, 'manageSettings')} />
      <Panel title="Books backup" className="grid gap-3">
        <p className="text-muted text-sm">Signed-in role: <span className="capitalize text-ink">{desk.role}</span>. Demo passwords are the role names, for this browser only.</p>
        <p className="text-sm"><Link className="text-gold" to="/users">Staff permissions</Link> · <Link className="text-gold" to="/audit">Audit log</Link></p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={download}>Export backup</Btn>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-gold/35 px-4 text-sm text-gold">
            Restore backup
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file && window.confirm('Replace the current books with this backup?')) restore(file)
                event.target.value = ''
              }}
            />
          </label>
          <BtnQuiet
            onClick={() => {
              if (window.confirm('Clear every invoice, rate change and stock movement stored in this browser?')) {
                onReplace(emptyBooks())
                setNote('Books reset to the opening showroom tags.')
              }
            }}
          >
            Reset books
          </BtnQuiet>
        </div>
      </Panel>
    </Screen>
  )
}

function Appearance({ accountId, canSetHouse }: { accountId: string | null; canSetHouse: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => readChoice(accountId))
  const [accent, setAccent] = useState(choice.accent?.[500] ?? '')
  const [accentNote, setAccentNote] = useState<string | null>(null)
  const mode = resolvedMode(choice.mode)

  function commit(next: ThemeChoice) {
    let stored: ThemeChoice = { ...next }
    if (stored.accent) {
      const background = paletteFor(stored.preset, resolvedMode(stored.mode)).bg0
      const check = accentOnDesk(stored.accent[500], background)
      if (!check.ok) {
        stored = { preset: stored.preset, mode: stored.mode, reduceEffects: stored.reduceEffects, comfortLevel: stored.comfortLevel }
        setAccentNote(check.reason)
      }
    }
    setChoice(stored)
    if (accountId) saveUserChoice(accountId, stored)
    else applyChoice(stored)
  }

  function applyAccent() {
    const background = paletteFor(choice.preset, mode).bg0
    const check = accentOnDesk(accent, background)
    if (!check.ok) {
      setAccentNote(check.reason)
      return
    }
    setAccentNote('Accent saved. It clears the contrast check.')
    commit({ ...choice, accent: check.scale })
  }

  return (
    <Panel title="Appearance" className="grid gap-4">
      <p className="text-muted text-sm">Aurora is the house default, at Soft: a cool glass desk with teal, blue and violet. Sage Mist and Mist Blue stay quieter. Midnight Sapphire and Obsidian Gold stay available as dark choices. The choice is saved on this account, and an admin can also set it for every account on this desk.</p>
      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(themePresets) as ThemePresetId[]).map((id) => {
          const preset = themePresets[id]
          const colors = preset[mode]
          const selected = choice.preset === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              className="rounded-2xl border p-3 text-left"
              style={{ background: colors.bg1, color: colors.text1, borderColor: selected ? colors.accent400 : 'transparent' }}
              onClick={() => {
                setAccent('')
                setAccentNote(null)
                commit({ preset: id, mode: choice.mode, reduceEffects: choice.reduceEffects, comfortLevel: choice.comfortLevel })
              }}
            >
              <span className="block h-12 rounded-xl" style={{ background: colors.accentGradient }} />
              <span className="mt-3 block font-serif text-xl">{preset.name}</span>
              <span className="mt-1 block text-xs" style={{ color: colors.text2 }}>{preset.note}</span>
              <span className="mt-3 block font-serif text-2xl" style={{ color: colors.numeral }}>LKR 1,250</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {([['dark', 'Dark'], ['light', 'Light'], ['system', 'Match this computer']] as const).map(([value, label]) => (
          <button key={value} type="button" className={`h-10 rounded-xl px-4 text-sm ${choice.mode === value ? 'bg-accent text-on-accent' : 'border border-line text-muted'}`} onClick={() => commit({ ...choice, mode: value as ThemeMode })}>
            {label}
          </button>
        ))}
      </div>
      <label className="text-muted flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={choice.reduceEffects}
          onChange={(event) => commit({ ...choice, reduceEffects: event.target.checked })}
        />
        Reduce effects. Stop the dashboard motion.
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Comfort level">
        {([[0, 'Light'], [4, 'Soft'], [8, 'Softest']] as const).map(([level, label]) => (
          <button
            key={level}
            type="button"
            aria-pressed={choice.comfortLevel === level}
            className={`h-10 rounded-xl px-4 text-sm ${choice.comfortLevel === level ? 'bg-accent text-on-accent' : 'border border-line text-muted'}`}
            onClick={() => commit({ ...choice, comfortLevel: level })}
          >
            {label}{level === 4 ? ' · usual' : ''}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="text-muted grid gap-1 text-xs">
          Accent override
          <input className="h-10 rounded-xl border border-line bg-field px-3 text-sm text-ink" value={accent} placeholder="6 digit hex" onChange={(event) => setAccent(event.target.value)} />
        </label>
        <Btn onClick={applyAccent}>Check accent</Btn>
        <BtnQuiet onClick={() => {
          setAccent('')
          setAccentNote(null)
          commit({ preset: choice.preset, mode: choice.mode, reduceEffects: choice.reduceEffects, comfortLevel: choice.comfortLevel })
        }}>Use the preset accent</BtnQuiet>
      </div>
      {accentNote ? <p className="text-sm text-gold">{accentNote}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canSetHouse ? <Btn onClick={() => saveTenantChoice(choice, accountId)}>Set as the house theme</Btn> : null}
        <BtnQuiet onClick={() => {
          if (!accountId) return
          clearUserChoice(accountId)
          const next = readChoice(accountId)
          setChoice(next)
          setAccent(next.accent?.[500] ?? '')
          setAccentNote(null)
        }}>Follow the house theme</BtnQuiet>
      </div>
    </Panel>
  )
}
