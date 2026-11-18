export interface PricingProduct {
    productId: string
    categoryId: string | null
    brandId: string | null
    variants: { variantId: string; price: number }[]
}

export interface IProductPricing {
    finalPrices(products: PricingProduct[]): Promise<Map<string, number>>
}