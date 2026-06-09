import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages are plain ESM; transpile them so Next bundles cleanly.
  // We build with webpack (`next build --webpack`) rather than Turbopack so the
  // workspace packages above this dir are compiled regardless of build root.
  transpilePackages: ['@conductor/coo-engine', '@conductor/agent-memory', '@conductor/agent-tools'],
}

export default nextConfig
