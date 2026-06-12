import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  // Bundle the SQL migration files into EVERY serverless function that touches
  // the database (getDb runs the migrator on first use), so the runtime migrator
  // can read them on Vercel. Missing an entry makes that route throw ENOENT on
  // its first DB call — e.g. the first chat message.
  outputFileTracingIncludes: {
    '/api/projects': ['./db/migrations/**/*'],
    '/api/projects/[id]': ['./db/migrations/**/*'],
    '/api/chat': ['./db/migrations/**/*'],
    '/api/auth/login': ['./db/migrations/**/*'],
    '/api/auth/me': ['./db/migrations/**/*'],
    '/api/billing/checkout': ['./db/migrations/**/*'],
    '/api/billing/portal': ['./db/migrations/**/*'],
    '/api/billing/webhook': ['./db/migrations/**/*'],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.md/,
      type: 'asset/source',
    })
    return config
  },
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vercel.com',
        port: '',
        pathname: '/api/www/avatar/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}

export default withBotId(nextConfig)
