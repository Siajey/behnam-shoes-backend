import { FavoriteListItem } from '@api/favorites/application'

export type UrlOf = (fileKey: string) => string

export class FavoritePresenter {
    static item(item: FavoriteListItem, urlOf: UrlOf) {
        return {
            productId: item.id,
            name: item.name,
            slug: item.slug,
            imageKey: item.imageKey,
            imageUrl: item.imageKey ? urlOf(item.imageKey) : null,
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
            inStock: item.inStock,
            favoritedAt: item.favoritedAt.toISOString(),
        }
    }
}