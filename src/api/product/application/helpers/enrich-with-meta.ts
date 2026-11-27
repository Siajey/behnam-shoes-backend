import {
    buildPricingMeta,
    IProductRatingRepository,
    IProductStatsRepository,
    ProductWithMeta,
    ProductWithVariants,
    tagsFor,
} from '@api/product/domain'

import {IProductPricing, PricingProduct} from '../ports'

export async function enrichWithMeta(
    pricing: IProductPricing,
    stats: IProductStatsRepository,
    ratings: IProductRatingRepository,
    views: readonly ProductWithVariants[],
    now: Date = new Date(),
): Promise<ProductWithMeta[]> {
    if (views.length === 0) return []
    const productIds: string[] = []
    const pricingProduct: PricingProduct[] = []
    views.forEach(view => {
        productIds.push(view.product.id)
        pricingProduct.push(
            {
                productId: view.product.id,
                categoryId: view.product.categoryId,
                brandId: view.product.brandId,
                variants: view.activeVariants.map((v) => ({variantId: v.id, price: v.price})),
            }
        )
    })

    const [finalPrices, flags, productRatings] = await Promise.all([
            pricing.finalPrices(pricingProduct),
            stats.findFlagsByProductIds(productIds),
            ratings.findByProductIds(productIds)
        ]
    )


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
            rating: productRatings.get(view.product.id) ?? {average: 0, count: 0}
        },
        attributes: []
    }))
}