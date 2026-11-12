export interface CheckoutCartLine {
    variantId: string
    productId: string
    productName: string
    productSlug: string
    imageKey: string | null
    attributes: { name: string; value: string }[]
    quantity: number
    originalUnitPrice: number
    unitPrice: number
    couponAllocation: number
}

export interface CheckoutCart {
    lines: CheckoutCartLine[]
    couponCode: string | null
    couponStatus: 'none' | 'applied' | 'invalid'
    subtotal: number
    productDiscountTotal: number
    couponDiscount: number
    total: number
}

export interface IGetCheckoutCart {
    execute(userId: string): Promise<CheckoutCart>
}

export interface IClearCartAfterOrder {
    execute(userId: string): Promise<void>
}