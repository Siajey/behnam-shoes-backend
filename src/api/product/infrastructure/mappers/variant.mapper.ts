import { Variant } from '@api/product/domain'

import { variantAttributes, variants } from '../models/variant.model'

type VariantRow = typeof variants.$inferSelect
type AttributeRow = typeof variantAttributes.$inferSelect

export class VariantMapper {
    static toDomain(row: VariantRow, attributes: AttributeRow[]): Variant {
        return Variant.restore({
            id: row.id,
            source: row.source,
            title: row.title,
            externalId: row.externalId,
            sku: row.sku,
            price: row.price,
            stock: row.stock,
            isActive: row.isActive,
            productId: row.productId,
            attributes: attributes.map((a) => ({ name: a.name, value: a.value })),
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(v: Variant): {
        variant: typeof variants.$inferInsert
        attributes: (typeof variantAttributes.$inferInsert)[]
    } {
        return {
            variant: {
                id: v.id,
                title: v.title,
                source: v.source,
                externalId: v.externalId,
                sku: v.sku,
                price: v.price,
                stock: v.stock,
                isActive: v.isActive,
                productId: v.productId,
                createdAt: v.createdAt,
                updatedAt: v.updatedAt,
            },
            attributes: v.attributes.map((a) => ({ variantId: v.id, name: a.name, value: a.value })),
        }
    }
}