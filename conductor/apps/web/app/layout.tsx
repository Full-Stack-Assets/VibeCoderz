import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conductor — constraint-optimized agentic coding',
  description:
    'Conductor routes every turn to the optimal model with a constraint-optimized orchestrator — budget-aware, fitness-scored, fully auditable.',
}

export const viewport: Viewport = {
  themeColor: '#faf9f5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
