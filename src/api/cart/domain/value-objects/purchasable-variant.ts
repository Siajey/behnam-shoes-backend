export interface PurchasableVariant {
    id: string
    productId: string | null
    categoryId: string | null
    brandId: string | null
    productName: string | null
    productSlug: string | null
    imageKey: string | null
    attributes: { name: string; value: string }[]
    price: number
    stock: number
    isActive: boolean
    isProductPublished: boolean
}