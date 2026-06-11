// ESM resolver hook so `node --test` can resolve the app's `@/` path alias
// (defined in tsconfig, which node doesn't read) when importing route handlers.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = resolvePath(ROOT, specifier.slice(2))
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`]) {
      if (existsSync(cand)) return nextResolve(pathToFileURL(cand).href, context)
    }
  }
  return nextResolve(specifier, context)
}
