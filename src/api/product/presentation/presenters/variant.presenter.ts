import { Variant } from '@api/product/domain'

export class VariantPresenter {
    static toPublic(v: Variant) {
        return { id: v.id, price: v.price, isAvailable: v.isAvailable, attributes: v.attributes }
    }

    static toAdmin(v: Variant) {
        return {
            id: v.id,
            productId: v.productId,
            source: v.source,
            externalId: v.externalId,
            sku: v.sku,
            title: v.title,
            price: v.price,
            stock: v.stock,
            isActive: v.isActive,
            attributes: v.attributes,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
        }
    }
}