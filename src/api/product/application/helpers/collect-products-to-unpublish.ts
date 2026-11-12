import { IProductRepository, IVariantRepository, Product, Variant } from '@api/product/domain'

import { unpublishIfNoActiveVariants } from './unpublish-if-no-active-variants'

export async function collectProductsToUnpublish(
    products: IProductRepository,
    variants: IVariantRepository,
    changed: readonly Variant[],
): Promise<Product[]> {
    const deactivated = changed.filter((v) => !v.isActive && v.productId !== null)
    if (deactivated.length === 0) return []

    const changedById = new Map(changed.map((v) => [v.id, v]))
    const productIds = [...new Set(deactivated.map((v) => v.productId as string))]
    const result: Product[] = []

    for (const productId of productIds) {
        const product = await products.findById(productId)
        if (!product) continue
        const current = await variants.findByProductId(productId)
        const merged = current.map((v) => changedById.get(v.id) ?? v)
        if (unpublishIfNoActiveVariants(product, merged)) result.push(product)
    }
    return result
}