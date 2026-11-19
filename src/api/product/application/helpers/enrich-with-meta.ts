import {
    buildPricingMeta, IProductStatsRepository, ProductWithMeta, ProductWithVariants, tagsFor,
} from '@api/product/domain'

import {IProductPricing} from '../ports'

export async function enrichWithMeta(
    pricing: IProductPricing,
    stats: IProductStatsRepository,
    views: readonly ProductWithVariants[],
    now: Date = new Date(),
): Promise<ProductWithMeta[]> {
    if (views.length === 0) return []

    const [finalPrices, flags] = await Promise.all([
        pricing.finalPrices(
            views.map((view) => ({
                productId: view.product.id,
                categoryId: view.product.categoryId,
                brandId: view.product.brandId,
                variants: view.activeVariants.map((v) => ({variantId: v.id, price: v.price})),
            })),
        ),
        stats.findFlagsByProductIds(views.map((v) => v.product.id)),
    ])

    return views.map((view) => ({
        view,
        meta: {
            tags: tagsFor(view.product.publishedAt, flags.get(view.product.id) ?? null, now),
            pricing: buildPricingMeta(
                view.activeVariants.map((v) => ({
                    originalPrice: v.price,
                    finalPrice: finalPrices.get(v.id) ?? v.price,
                })),
            ),
        },
        attributes: []
    }))
}