import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Conductor is a nested pnpm workspace; pin the build root so Turbopack doesn't
  // pick up a parent lockfile.
  turbopack: {
    root: path.resolve(import.meta.dirname, '..', '..'),
  },
  // Workspace packages are plain ESM; transpile them so Next bundles cleanly.
  transpilePackages: ['@conductor/coo-engine', '@conductor/agent-memory'],
}

export default nextConfig
