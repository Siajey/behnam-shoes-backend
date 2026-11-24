import { normalizePersianLetters, toLatinDigits } from '@common/util'

import { InvalidShippingDestinationError } from '../errors'

export interface ShippingPlace {
  postalCode: string
  province: string
  city: string
}

export interface Parcel {
  weightGrams: number
  declaredValue: number
}

export interface ParcelLine {
  variantId: string
  productId: string
  quantity: number
  unitPrice: number
}

export const normalizePostalCode = (raw: string): string =>
  toLatinDigits(raw.trim()).replace(/[\s-]/g, '')

export function normalizePlace(place: ShippingPlace): ShippingPlace {
  const postalCode = normalizePostalCode(place.postalCode)
  if (!/^\d{10}$/.test(postalCode)) throw new InvalidShippingDestinationError('postalCode')

  return {
    postalCode,
    province: normalizePersianLetters(place.province.trim()),
    city: normalizePersianLetters(place.city.trim()),
  }
}
