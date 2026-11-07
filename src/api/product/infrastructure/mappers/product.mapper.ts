import { NonOperationalError } from '@common/errors'
import {Product, ProductProps, ShoeProduct} from '@api/product/domain'

import { productImages, products, shoeProductDetails } from '../models/product.model'

type ProductRow = typeof products.$inferSelect
type ImageRow = typeof productImages.$inferSelect
type ShoeRow = typeof shoeProductDetails.$inferSelect

export class ProductMapper {
    static toDomain(row: ProductRow, images: ImageRow[], shoe: ShoeRow | null): Product {
        const props: ProductProps = {
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            status: row.status,
            categoryId: row.categoryId,
            brandId: row.brandId,
            images: images
                .map((i) => ({ id: i.id, fileKey: i.fileKey, altText: i.altText, position: i.position }))
                .sort((a, b) => a.position - b.position),
            publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        }

        switch (row.type) {
            case 'shoe':
                if (!shoe) {
                    throw new NonOperationalError({ details: { productId: row.id, missing: 'shoe details' } })
                }
                return ShoeProduct.restore(props, { gender: shoe.gender, material: shoe.material })
            default:
                throw new NonOperationalError({ details: { productId: row.id, type: row.type } })
        }
    }

    static toPersistence(product: Product): {
        product: typeof products.$inferInsert
        images: (typeof productImages.$inferInsert)[]
        shoe: typeof shoeProductDetails.$inferInsert | null
    } {
        return {
            product: {
                id: product.id,
                type: product.type,
                name: product.name,
                slug: product.slug,
                description: product.description,
                status: product.status,
                categoryId: product.categoryId,
                brandId: product.brandId,
                publishedAt: product.publishedAt ?? null,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            },
            images: product.images.map((i) => ({
                id: i.id,
                productId: product.id,
                fileKey: i.fileKey,
                altText: i.altText,
                position: i.position,
            })),
            shoe:
                product instanceof ShoeProduct
                    ? { productId: product.id, gender: product.gender, material: product.material }
                    : null,
        }
    }
}