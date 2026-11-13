import { FavoriteListItem } from '@api/favorites/application'

export class FavoritePresenter {
    static item(item: FavoriteListItem) {
        return {
            productId: item.id,
            name: item.name,
            slug: item.slug,
            imageKey: item.imageKey,
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
            inStock: item.inStock,
            favoritedAt: item.favoritedAt.toISOString(),
        }
    }
}