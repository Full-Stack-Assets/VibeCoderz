import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages are plain ESM; transpile them so Next bundles cleanly.
  // We build with webpack (`next build --webpack`) rather than Turbopack so the
  // workspace packages above this dir are compiled regardless of build root.
  transpilePackages: ['@conductor/coo-engine', '@conductor/agent-memory', '@conductor/agent-tools', '@conductor/eval'],
  // @vercel/sandbox is a Node SDK loaded at runtime (only when
  // CONDUCTOR_SANDBOX=vercel); keep it external so it isn't bundled into the
  // client and resolves from node_modules in the server function.
  serverExternalPackages: ['@vercel/sandbox'],
}

export default nextConfig
