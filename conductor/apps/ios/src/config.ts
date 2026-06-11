/**
 * App configuration persisted across launches (backend URL + tool mode).
 * Defaults the server to the deployed Conductor on Vercel; fully editable in
 * the in-app Settings sheet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

/** Deployed Conductor — referenced as the canonical site URL in coo-engine. */
export const DEFAULT_BASE_URL = 'https://conductor-xi.vercel.app'

export interface Settings {
  baseUrl: string
  agentic: boolean
}

const KEY = 'conductor.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_BASE_URL,
  agentic: false,
}

/** Strip a trailing slash so `${baseUrl}/api/chat` is always well-formed. */
export const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, '')

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      baseUrl: normalizeBaseUrl(parsed.baseUrl || DEFAULT_BASE_URL) || DEFAULT_BASE_URL,
      agentic: !!parsed.agentic,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, baseUrl: normalizeBaseUrl(s.baseUrl) }))
  } catch {
    // Persistence is best-effort; in-memory settings still apply this session.
  }
}
