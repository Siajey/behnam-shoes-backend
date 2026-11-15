export interface PromotionLine {
  variantId: string
  productId: string
  categoryId: string | null
  brandId: string | null
  unitPrice: number
  quantity: number
}

export interface PromotionResult {
  lines: {
    variantId: string
    originalUnitPrice: number
    unitPrice: number
    couponAllocation: number
  }[]
  coupon:
    | { status: 'none' }
    | { status: 'applied'; couponId: string; code: string; discount: number }
    | { status: 'invalid'; reason: string }
}

export interface IOrderPromotions {
  price(input: { userId: string; lines: PromotionLine[]; couponCode: string | null }): Promise<PromotionResult>
  reserveCoupon(input: { couponId: string; userId: string; orderId: string; discountAmount: number }): Promise<void>
  commitCoupon(orderId: string): Promise<void>
  releaseCoupon(orderId: string): Promise<void>
}
