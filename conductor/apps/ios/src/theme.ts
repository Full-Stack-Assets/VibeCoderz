/**
 * Conductor — Claude iOS design tokens.
 * Palette mirrors conductor/apps/web/app/globals.css (Anthropic / Claude):
 *   ivory #faf9f5 · ink #141413 · coral #d97757 · clay borders #e8e6dc
 */

export interface Theme {
  dark: boolean
  bg: string
  surface: string
  surfaceSunk: string
  userBubble: string
  text: string
  textSoft: string
  muted: string
  faint: string
  line: string
  lineStrong: string
  coral: string
  coralPress: string
  coralTint: string
  blue: string
  green: string
  onCoral: string
}

const light: Theme = {
  dark: false,
  bg: '#faf9f5',
  surface: '#ffffff',
  surfaceSunk: '#f3f1ea',
  userBubble: '#ece9df',
  text: '#141413',
  textSoft: '#3d3d3a',
  muted: '#73726c',
  faint: '#b0aea5',
  line: '#e8e6dc',
  lineStrong: '#ddd9cb',
  coral: '#d97757',
  coralPress: '#c5634a',
  coralTint: '#f6e9e2',
  blue: '#6a9bcc',
  green: '#788c5d',
  onCoral: '#ffffff',
}

const dark: Theme = {
  dark: true,
  bg: '#262624',
  surface: '#30302e',
  surfaceSunk: '#1f1e1d',
  userBubble: '#3a3a37',
  text: '#f5f4ee',
  textSoft: '#e3e1d8',
  muted: '#a3a199',
  faint: '#6f6e67',
  line: '#3c3b38',
  lineStrong: '#4a4945',
  coral: '#d97757',
  coralPress: '#c5634a',
  coralTint: '#3a2a23',
  blue: '#6a9bcc',
  green: '#788c5d',
  onCoral: '#1f1e1d',
}

/** Accepts RN's ColorSchemeName ('light' | 'dark' | 'unspecified' | null). */
export const getTheme = (scheme: string | null | undefined): Theme =>
  scheme === 'dark' ? dark : light

/** Serif display face for the wordmark — system serif evokes the Claude type. */
export const SERIF = 'Georgia'
export const MONO = 'Menlo'

export const radius = { lg: 22, md: 16, sm: 12, xs: 8 }
