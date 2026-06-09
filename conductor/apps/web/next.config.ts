import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages are plain ESM; transpile them so Next bundles cleanly.
  // We build with webpack (`next build --webpack`) rather than Turbopack: on
  // Vercel the build is rooted at apps/web, and Turbopack refuses to compile the
  // workspace packages that live above that root. Webpack + transpilePackages
  // bundles them regardless of root.
  transpilePackages: ['@conductor/coo-engine', '@conductor/agent-memory', '@conductor/agent-tools'],
}

export default nextConfig
