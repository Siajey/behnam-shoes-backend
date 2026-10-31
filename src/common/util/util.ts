import { join } from 'path'
import { CookieModel } from '../api'
import { IHashGenerator } from '@common/security'

export const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)

export function resolveAssetPath(...segments: string[]) {
  return join(__dirname, '..', '..', 'common', 'assets', ...segments)
}

export const serializeCookie = (cookie: CookieModel): string => {
  const parts: string[] = []
  parts.push(`${cookie.key}=${cookie.value}`)
  if (cookie.path) parts.push(`Path=${cookie.path}`)
  if (cookie.httpOnly) parts.push(`HttpOnly`)
  if (cookie.secure) parts.push(`Secure`)
  if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`)
  if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`)
  return parts.join('; ')
}
export const deserializeCookies = (
  setCookieHeader: string[] | string | undefined,
): Record<string, string> => {
  const cookies: Record<string, string> = {}
  if (!setCookieHeader) return cookies
  const setCookies: string[] =
    typeof setCookieHeader === 'string' ? setCookieHeader.split(',') : setCookieHeader

  for (const cookie of setCookies) {
    const [keyValue] = cookie.split(';') // "key=value"
    const [key, value] = keyValue.split('=')
    if (key && value) {
      cookies[key.trim()] = value.trim()
    }
  }

  return cookies
}

export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

export const generateProviderUsername = (
  email: string,
  provider: string,
  hashGenerator: IHashGenerator,
): string => {
  const maxLength = 20
  const suffix = hashGenerator.generateSecret(4)
  const separator = '_'

  const maxBaseLength =
    maxLength - separator.length - provider.length - separator.length - suffix.length

  const base = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, maxBaseLength)

  return `${base}_${provider}_${suffix}`
}
