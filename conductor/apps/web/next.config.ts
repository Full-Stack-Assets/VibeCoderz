import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Workspace packages are plain ESM; transpile them so Next bundles cleanly.
  // We build with webpack (`next build --webpack`) rather than Turbopack: on
  // Vercel the build is rooted at apps/web, and Turbopack refuses to compile the
  // workspace packages that live above that root. Webpack + transpilePackages
  // bundles them regardless of root.
  transpilePackages: ['@conductor/coo-engine', '@conductor/agent-memory', '@conductor/agent-tools'],
  // Trace from the monorepo root so the standalone/serverless output captures the
  // hoisted node_modules (which pnpm's `node-linker=hoisted` places at the
  // workspace root), avoiding broken paths when Vercel hydrates the prebuilt output.
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
}

export default nextConfig
