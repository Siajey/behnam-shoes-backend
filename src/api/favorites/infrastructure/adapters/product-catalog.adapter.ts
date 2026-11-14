import { Inject, Injectable } from '@nestjs/common'

import { IGetPublishedProductIds, IGetPublishedProductsByIds } from '@api/product/application'
import { GET_PUBLISHED_PRODUCT_IDS, GET_PUBLISHED_PRODUCTS_BY_IDS } from '@common/di'
import { FavoriteProductSummary } from '@api/favorites/domain'
import { IFavoriteProductCatalog } from '@api/favorites/application'

@Injectable()
export class ProductFavoriteCatalog implements IFavoriteProductCatalog {
    constructor(
        @Inject(GET_PUBLISHED_PRODUCT_IDS) private readonly getIds: IGetPublishedProductIds,
        @Inject(GET_PUBLISHED_PRODUCTS_BY_IDS) private readonly getProducts: IGetPublishedProductsByIds,
    ) {}

    findPublishedIds(productIds: string[]): Promise<string[]> {
        return this.getIds.execute(productIds)
    }

    async findSummaries(productIds: string[]): Promise<FavoriteProductSummary[]> {
        if (productIds.length === 0) return []
        const products = await this.getProducts.execute(productIds)
        return products.map((view) => ({
            id: view.product.id,
            name: view.product.name,
            slug: view.product.slug,
            imageKey: view.product.primaryImage?.fileKey ?? null,
            minPrice: view.minPrice,
            maxPrice: view.maxPrice,
            inStock: view.isInStock,
        }))
    }
}