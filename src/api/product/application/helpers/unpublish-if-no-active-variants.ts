import { Product, Variant } from '@api/product/domain'

export function unpublishIfNoActiveVariants(
    product: Product,
    remaining: readonly Variant[],
): boolean {
    if (product.status === 'published' && !remaining.some((v) => v.isActive)) {
        product.unpublish()
        return true
    }
    return false
}