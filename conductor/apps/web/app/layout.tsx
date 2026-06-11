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

// Applied before paint so the persisted (or system) theme never flashes.
const themeInit = `(function(){try{var t=localStorage.getItem('conductor-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;if(d)e.classList.add('dark');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  )
}
