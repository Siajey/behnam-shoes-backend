export interface EstimatedDays {
  min: number
  max: number
}

export type QuoteSource = 'carrier' | 'fallback'

export interface ShippingQuote {
  methodCode: string
  name: string
  description: string | null
  fee: number
  isFree: boolean
  estimatedDays: EstimatedDays | null
  source: QuoteSource
}

export interface UnavailableShippingOption {
  methodCode: string
  name: string
  description: string | null
  available: false
}

export type ShippingOption = (ShippingQuote & { available: true }) | UnavailableShippingOption
