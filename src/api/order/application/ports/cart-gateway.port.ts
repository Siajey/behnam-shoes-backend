export interface CheckoutLine {
  variantId: string
  productId: string
  categoryId: string | null
  brandId: string | null
  productName: string
  productSlug: string
  imageKey: string | null
  attributes: { name: string; value: string }[]
  quantity: number
  unitPrice: number
}

export interface CheckoutSnapshot {
  lines: CheckoutLine[]
  couponCode: string | null
}

export interface ICartGateway {
  getCheckout(userId: string): Promise<CheckoutSnapshot>
  clear(userId: string): Promise<void>
}
