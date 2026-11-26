export interface ShippingQuoteRequest {
  methodCode: string
  destination: { postalCode: string; province: string; city: string }
  lines: { variantId: string; productId: string; quantity: number; unitPrice: number }[]
  subtotalAfterDiscounts: number
}

export interface ShippingQuoteResult {
  methodCode: string
  methodName: string
  fee: number
}

export interface IOrderShippingQuotes {
  quote(request: ShippingQuoteRequest): Promise<ShippingQuoteResult>
}
