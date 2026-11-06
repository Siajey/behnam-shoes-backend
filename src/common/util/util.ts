import { join } from 'path'
import { CookieModel } from '../api'
import { IHashGenerator } from '@common/security'
import {VariantAttribute} from "@api/product/domain/entities";

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


export const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeValue(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
}

export function normalizeAttributes(attrs: VariantAttribute[]): VariantAttribute[] {
    const byName = new Map<string, string>()
    for (const a of attrs) byName.set(normalizeValue(a.name), normalizeValue(a.value))
    return [...byName].map(([name, value]) => ({ name, value }))
}
