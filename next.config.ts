import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  // Bundle the SQL migration files into the serverless functions that touch the
  // database so the runtime migrator can read them on Vercel.
  outputFileTracingIncludes: {
    '/api/projects': ['./db/migrations/**/*'],
    '/api/projects/[id]': ['./db/migrations/**/*'],
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
