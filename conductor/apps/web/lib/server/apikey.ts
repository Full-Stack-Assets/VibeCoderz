import { createHash, randomBytes } from 'node:crypto'
import { getStore } from '@conductor/agent-memory'
import type { DBUser } from './session'

/** Store surface for API keys (only the SHA-256 hash is persisted). */
export interface ApiKeyStore {
  createApiKey(
    userId: string,
    label: string | undefined,
    hash: string
  ): Promise<{ id: string; label: string; createdAt: number | Date }>
  resolveApiKey(hash: string): Promise<{ id: string; userId: string } | null>
  listApiKeys(
    userId: string
  ): Promise<
    Array<{ id: string; label: string; createdAt: number | Date; lastUsedAt: number | Date | null; requests: number; costUSD: number }>
  >
  revokeApiKey(userId: string, keyId: string): Promise<boolean>
  bumpApiKeyUsage(keyId: string, costUSD: number): Promise<void>
  getUserById(id: string): Promise<DBUser | null>
}

export async function apiKeyStore(): Promise<ApiKeyStore> {
  return (await getStore()) as unknown as ApiKeyStore
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Generate a new API key: the plaintext (shown once) and its stored hash. */
export function generateApiKey(): { key: string; hash: string } {
  const key = `sk_cond_${randomBytes(24).toString('base64url')}`
  return { key, hash: hashKey(key) }
}

/** Extract the presented key from `Authorization: Bearer …` or `X-API-Key`. */
export function keyFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
  if (m) return m[1].trim()
  const x = req.headers.get('x-api-key')
  return x ? x.trim() : null
}

/** Resolve a request's API key to its owning user + key id, or null. */
export async function userFromApiKey(req: Request): Promise<{ user: DBUser; keyId: string } | null> {
  const key = keyFromRequest(req)
  if (!key) return null
  const store = await apiKeyStore()
  const rec = await store.resolveApiKey(hashKey(key))
  if (!rec) return null
  const user = await store.getUserById(rec.userId)
  return user ? { user, keyId: rec.id } : null
}
