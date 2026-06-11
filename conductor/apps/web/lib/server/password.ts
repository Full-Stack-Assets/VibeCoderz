import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Self-contained password hashing with Node's scrypt (no native/3rd-party deps).
// Stored format: `<saltHex>:<derivedKeyHex>`.
const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>
const KEYLEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const dk = await scrypt(password, salt, KEYLEN)
  return `${salt}:${dk.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(':')
  if (!salt || !keyHex) return false
  const dk = await scrypt(password, salt, KEYLEN)
  const keyBuf = Buffer.from(keyHex, 'hex')
  return keyBuf.length === dk.length && timingSafeEqual(keyBuf, dk)
}

export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 200) return 'Password is too long.'
  return null
}
