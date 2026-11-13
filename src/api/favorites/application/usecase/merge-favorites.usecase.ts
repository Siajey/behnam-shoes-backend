import { Favorite, IFavoriteRepository, remainingFavoriteCapacity } from '@api/favorites/domain'

import { IMergeFavorites, MergeFavoritesResult } from '../interfaces'
import { IFavoriteProductCatalog } from '../ports'

export default class MergeFavoritesUseCase implements IMergeFavorites {
    constructor(
        private readonly favorites: IFavoriteRepository,
        private readonly catalog: IFavoriteProductCatalog,
    ) {}

    async execute(productIds: string[], userId: string): Promise<MergeFavoritesResult> {
        const wanted = [...new Set(productIds)]
        const published = new Set(await this.catalog.findPublishedIds(wanted))

        const current = await this.favorites.listByUserId(userId)
        const existing = new Set(current.map((f) => f.productId))
        let capacity = remainingFavoriteCapacity(current.length)

        const now = Date.now()
        const toAdd: Favorite[] = []
        const skippedProductIds: string[] = []

        wanted.forEach((productId, index) => {
            if (!published.has(productId)) {
                skippedProductIds.push(productId)
            } else if (!existing.has(productId)) {
                if (capacity <= 0) {
                    skippedProductIds.push(productId)
                } else {
                    toAdd.push(Favorite.create(userId, productId, new Date(now - index)))
                    capacity--
                }
            }
        })

        if (toAdd.length > 0) await this.favorites.add(toAdd)
        return { added: toAdd.length, skippedProductIds }
    }
}