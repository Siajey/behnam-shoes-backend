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

export const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

const DIGIT_REGEX = /[۰-۹٠-٩]/g

export const toLatinDigits = (value: string): string =>
    value.replace(DIGIT_REGEX, (digit) => {
        const code = digit.charCodeAt(0)
        return String(code - (code >= 0x0660 && code <= 0x0669 ? 0x0660 : 0x06f0))
    })

export const normalizePersianLetters = (value: string): string =>
    value.replace(/[يىك]/g, (char) => {
        switch (char) {
            case 'ي':
            case 'ى':
                return 'ی'
            case 'ك':
                return 'ک'
            default:
                return char
        }
    })

export function normalizeText(value: string): string {
    return normalizePersianLetters(toLatinDigits(value.trim().toLowerCase()))
}

export const normalizeValue = normalizeText

export function normalizeAttributes(attrs: VariantAttribute[]): VariantAttribute[] {
    const byName = new Map<string, string>()

    for (const { name, value } of attrs) {
        byName.set(normalizeValue(name), normalizeValue(value))
    }

    return [...byName].map(([name, value]) => ({ name, value }))
}