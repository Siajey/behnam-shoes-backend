import {ProductRating} from "@api/product/domain";

export const PRODUCT_TAGS = ['newest', 'best_seller', 'popular'] as const
export type ProductTag = (typeof PRODUCT_TAGS)[number]

export interface ProductPricingMeta {
    minPrice: number | null
    maxPrice: number | null
    finalMinPrice: number | null
    finalMaxPrice: number | null
    hasDiscount: boolean
    maxDiscountPercent: number
}

export interface ProductMeta {
    tags: ProductTag[]
    pricing: ProductPricingMeta
    rating: ProductRating
}

export interface ProductTagFlags {
    isBestSeller: boolean
    isPopular: boolean
}

export interface VariantPricePair {
    originalPrice: number
    finalPrice: number
}