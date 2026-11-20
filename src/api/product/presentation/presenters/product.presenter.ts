import { Product, ProductImage, ProductWithVariants, ShoeProduct } from '@api/product/domain'
import { UploadTarget } from '@common/storage'
import { ProductMeta, ProductWithMeta } from '@api/product/domain'

import { VariantPresenter } from './variant.presenter'
import { AttributePresenter } from "./attribute.presenter"

export type UrlOf = (fileKey: string) => string
const metaOf = (m: ProductMeta) => ({ tags: m.tags, pricing: m.pricing })

const typeDetails = (p: Product) =>
    p instanceof ShoeProduct ? { gender: p.gender, material: p.material } : null

const publicImage = (i: ProductImage | null, urlOf: UrlOf) =>
    i ? { fileKey: i.fileKey, url: urlOf(i.fileKey), altText: i.altText } : null

export class ProductPresenter {
    static publicListItem(item: ProductWithMeta, urlOf: UrlOf) {
        const { view, meta } = item
        const p = view.product
        return {
            id: p.id,
            type: p.type,
            name: p.name,
            slug: p.slug,
            categoryId: p.categoryId,
            brandId: p.brandId,
            primaryImage: publicImage(p.primaryImage, urlOf),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            details: typeDetails(p),
            meta: metaOf(meta),
        }
    }

    static publicDetail(item: ProductWithMeta, urlOf: UrlOf) {
        const {view} = item
        return {
            ...ProductPresenter.publicListItem(item, urlOf),
            description: view.product.description,
            images: view.product.images.map((i) => publicImage(i, urlOf)),
            options: view.options,
            variants: view.activeVariants.map(VariantPresenter.toPublic),
            attributes: item.attributes.map(AttributePresenter.resolved), // visible ones only
        }
    }
    static adminProduct(p: Product, urlOf: UrlOf) {
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
                url: urlOf(i.fileKey),
                altText: i.altText,
                position: i.position,
            })),
            details: typeDetails(p),
            publishedAt: p.publishedAt?.toISOString() ?? null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        }
    }

    static adminListItem(view: ProductWithVariants, urlOf: UrlOf) {
        const p = view.product
        return {
            id: p.id,
            type: p.type,
            name: p.name,
            slug: p.slug,
            status: p.status,
            categoryId: p.categoryId,
            brandId: p.brandId,
            primaryImage: publicImage(p.primaryImage, urlOf),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            variantCount: view.variants.length,
            activeVariantCount: view.activeVariants.length,
            updatedAt: p.updatedAt.toISOString(),
        }
    }

    static adminDetail(view: ProductWithVariants, urlOf: UrlOf) {
        return {
            ...ProductPresenter.adminProduct(view.product, urlOf),
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
            options: view.options,
            variants: view.variants.map(VariantPresenter.toAdmin),
        }
    }

    static uploadTarget(t: UploadTarget) {
        return {
            key: t.key,
            uploadUrl: t.url,
            fields: t.fields,
            method: t.method,
            headers: t.headers,
            expiresInSeconds: t.expiresInSeconds,
            publicUrl: t.publicUrl,
        }
    }
}

