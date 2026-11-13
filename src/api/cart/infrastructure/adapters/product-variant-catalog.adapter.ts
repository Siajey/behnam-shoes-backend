import { Inject, Injectable } from '@nestjs/common'

import { IGetPublishedProductsByIds, IGetVariantsByIds } from '@api/product/application'
import { GET_PUBLISHED_PRODUCTS_BY_IDS, GET_VARIANTS_BY_IDS } from '@common/di'
import { PurchasableVariant } from '@api/cart/domain'
import { IVariantCatalog } from '@api/cart/application'

@Injectable()
export class ProductVariantCatalog implements IVariantCatalog {
    constructor(
        @Inject(GET_VARIANTS_BY_IDS) private readonly getVariants: IGetVariantsByIds,
        @Inject(GET_PUBLISHED_PRODUCTS_BY_IDS) private readonly getProducts: IGetPublishedProductsByIds,
    ) {}

    async findByIds(variantIds: string[]): Promise<PurchasableVariant[]> {
        const variants = await this.getVariants.execute(variantIds)

        const productIds = [
            ...new Set(variants.map((v) => v.productId).filter((id): id is string => id !== null)),
        ]
        const published = await this.getProducts.execute(productIds)
        const productById = new Map(published.map((p) => [p.product.id, p.product]))

        return variants.map((v): PurchasableVariant => {
            const product = v.productId ? productById.get(v.productId) : undefined
            return {
                id: v.id,
                productId: v.productId,
                categoryId: product?.categoryId ?? null,
                brandId: product?.brandId ?? null,
                productName: product?.name ?? null,
                productSlug: product?.slug ?? null,
                imageKey: product?.primaryImage?.fileKey ?? null,
                attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
                price: v.price,
                stock: v.stock,
                isActive: v.isActive,
                isProductPublished: product !== undefined,
            }
        })
    }
}