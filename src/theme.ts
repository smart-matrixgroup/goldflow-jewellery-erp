import { accentMeetsAa, themePresetIds, type AccentScale, type ThemeMode, type ThemePresetId } from '@goldflow/ui-tokens'

export type ComfortLevel = 0 | 4 | 8

export type ThemeChoice = {
  preset: ThemePresetId
  mode: ThemeMode
  reduceEffects: boolean
  comfortLevel: ComfortLevel
  accent?: AccentScale
}

const tenantKey = 'goldflow.erp.theme.tenant'
const sessionName = 'goldflow.erp.session'

export function userThemeKey(accountId: string) {
  return `goldflow.erp.theme.user.${accountId}`
}

const fallback: ThemeChoice = { preset: 'sand-stone', mode: 'light', reduceEffects: false, comfortLevel: 4 }

function comfortLevelOf(parsed: { comfortLevel?: unknown; comfort?: unknown }): ComfortLevel {
  if (parsed.comfortLevel === 0 || parsed.comfortLevel === 4 || parsed.comfortLevel === 8) return parsed.comfortLevel
  return parsed.comfort === true ? 8 : 4
}

function parseChoice(raw: string | null): ThemeChoice | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { preset?: string; mode?: ThemeMode; reduceEffects?: boolean; comfortLevel?: unknown; comfort?: boolean; accent?: AccentScale }
    const preset = parsed.preset === 'pearl-fresh' ? 'sand-stone' : parsed.preset
    if (!themePresetIds.includes(preset as ThemePresetId)) return null
    const mode: ThemeMode = parsed.mode === 'light' || parsed.mode === 'system' || parsed.mode === 'dark' ? parsed.mode : 'dark'
    const accent = parsed.accent
    return {
      preset: preset as ThemePresetId,
      mode,
      reduceEffects: Boolean(parsed.reduceEffects),
      comfortLevel: comfortLevelOf(parsed),
      ...(accent ? { accent } : {}),
    }
  } catch {
    return null
  }
}

export function readChoice(accountId: string | null): ThemeChoice {
  const user = accountId ? parseChoice(localStorage.getItem(userThemeKey(accountId))) : null
  return user ?? parseChoice(localStorage.getItem(tenantKey)) ?? fallback
}

export function resolvedMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement
  root.dataset.theme = choice.preset
  root.dataset.mode = resolvedMode(choice.mode)
  if (choice.reduceEffects) root.dataset.effects = 'off'
  else delete root.dataset.effects
  delete root.dataset.comfort
  root.style.setProperty('--dim', String(choice.comfortLevel))
  const names = ['--accent-200', '--accent-300', '--accent-400', '--accent-500', '--accent-600', '--accent-gradient', '--on-accent']
  for (const name of names) root.style.removeProperty(name)
  if (!choice.accent) return
  root.style.setProperty('--accent-200', choice.accent[200])
  root.style.setProperty('--accent-300', choice.accent[300])
  root.style.setProperty('--accent-400', choice.accent[400])
  root.style.setProperty('--accent-500', choice.accent[500])
  root.style.setProperty('--accent-600', choice.accent[600])
  root.style.setProperty('--accent-gradient', choice.accent.gradient)
  root.style.setProperty('--on-accent', choice.accent.on)
}

export function saveUserChoice(accountId: string, choice: ThemeChoice) {
  localStorage.setItem(userThemeKey(accountId), JSON.stringify(choice))
  applyChoice(choice)
}

export function saveTenantChoice(choice: ThemeChoice, accountId: string | null) {
  localStorage.setItem(tenantKey, JSON.stringify(choice))
  applyChoice(readChoice(accountId))
}

export function clearUserChoice(accountId: string) {
  localStorage.removeItem(userThemeKey(accountId))
  applyChoice(readChoice(accountId))
}

export function sessionAccount() {
  try {
    return sessionStorage.getItem(sessionName)
  } catch {
    return null
  }
}

export function accentOnDesk(hex: string, background: string) {
  return accentMeetsAa(hex, background)
}
