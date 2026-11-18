import { ProductPricingMeta, VariantPricePair } from '../value-objects'

const percentOff = (p: VariantPricePair): number =>
    p.finalPrice < p.originalPrice && p.originalPrice > 0
        ? Math.max(1, Math.floor(((p.originalPrice - p.finalPrice) * 100) / p.originalPrice))
        : 0

export function buildPricingMeta(pairs: readonly VariantPricePair[]): ProductPricingMeta {
    if (pairs.length === 0) {
        return {
            minPrice: null,
            maxPrice: null,
            finalMinPrice: null,
            finalMaxPrice: null,
            hasDiscount: false,
            maxDiscountPercent: 0,
        }
    }

    const originals = pairs.map((p) => p.originalPrice)
    const finals = pairs.map((p) => p.finalPrice)

    return {
        minPrice: Math.min(...originals),
        maxPrice: Math.max(...originals),
        finalMinPrice: Math.min(...finals),
        finalMaxPrice: Math.max(...finals),
        hasDiscount: pairs.some((p) => p.finalPrice < p.originalPrice),
        maxDiscountPercent: Math.max(...pairs.map(percentOff)),
    }
}