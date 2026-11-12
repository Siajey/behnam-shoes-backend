import { Product, ProductImage, ProductWithVariants, ShoeProduct } from '@api/product/domain'

import { VariantPresenter } from './variant.presenter'

const typeDetails = (p: Product) =>
    p instanceof ShoeProduct ? { gender: p.gender, material: p.material } : null

const publicImage = (i: ProductImage | null) =>
    i ? { fileKey: i.fileKey, altText: i.altText } : null

export class ProductPresenter {
    static publicListItem(view: ProductWithVariants) {
        const p = view.product
        return {
            id: p.id,
            type: p.type,
            name: p.name,
            slug: p.slug,
            categoryId: p.categoryId,
            brandId: p.brandId,
            primaryImage: publicImage(p.primaryImage),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            details: typeDetails(p),
        }
    }

    static publicDetail(view: ProductWithVariants) {
        return {
            ...ProductPresenter.publicListItem(view),
            description: view.product.description,
            images: view.product.images.map(publicImage),
            options: view.options,
            variants: view.activeVariants.map(VariantPresenter.toPublic),
        }
    }

    static adminProduct(p: Product) {
        return {
            id: p.id,
            type: p.type,
            name: p.name,
            slug: p.slug,
            description: p.description,
            status: p.status,
            categoryId: p.categoryId,
            brandId: p.brandId,
            images: p.images.map((i) => ({
                id: i.id,
                fileKey: i.fileKey,
                altText: i.altText,
                position: i.position,
            })),
            details: typeDetails(p),
            publishedAt: p.publishedAt?.toISOString() ?? null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        }
    }

    static adminListItem(view: ProductWithVariants) {
        const p = view.product
        return {
            id: p.id,
            type: p.type,
            name: p.name,
            slug: p.slug,
            status: p.status,
            categoryId: p.categoryId,
            brandId: p.brandId,
            primaryImage: publicImage(p.primaryImage),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            variantCount: view.variants.length,
            activeVariantCount: view.activeVariants.length,
            updatedAt: p.updatedAt.toISOString(),
        }
    }

    static adminDetail(view: ProductWithVariants) {
        return {
            ...ProductPresenter.adminProduct(view.product),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            options: view.options,
            variants: view.variants.map(VariantPresenter.toAdmin),
        }
    }
}