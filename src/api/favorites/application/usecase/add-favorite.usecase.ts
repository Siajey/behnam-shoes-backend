import {
    Favorite,
    FavoriteLimitReachedError,
    FavoriteProductNotFoundError,
    IFavoriteRepository,
    MAX_FAVORITES,
    remainingFavoriteCapacity,
} from '@api/favorites/domain'

import { IAddFavorite } from '../interfaces'
import { IFavoriteProductCatalog } from '../ports'

export default class AddFavoriteUseCase implements IAddFavorite {
    constructor(
        private readonly favorites: IFavoriteRepository,
        private readonly catalog: IFavoriteProductCatalog,
    ) {}

    async execute(productId: string, userId: string): Promise<void> {
        const published = await this.catalog.findPublishedIds([productId])
        if (!published.includes(productId)) throw new FavoriteProductNotFoundError(productId)

        const current = await this.favorites.listByUserId(userId)
        if (current.some((f) => f.productId === productId)) return

        if (remainingFavoriteCapacity(current.length) === 0) throw new FavoriteLimitReachedError(MAX_FAVORITES)
        await this.favorites.add([Favorite.create(userId, productId)])
    }
}