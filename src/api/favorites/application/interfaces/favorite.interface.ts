import { FavoriteProductSummary } from '@api/favorites/domain'

export interface ListFavoritesQuery {
    pageSize?: number
    nextCursor?: string
}

export type FavoriteListItem = FavoriteProductSummary & { favoritedAt: Date }

export interface FavoritesPage {
    items: FavoriteListItem[]
    nextCursor: string | null
}

export interface MergeFavoritesResult {
    added: number
    skippedProductIds: string[]
}

export interface IListFavorites {
    execute(userId: string, query: ListFavoritesQuery): Promise<FavoritesPage>
}
export interface IListFavoriteIds {
    execute(userId: string): Promise<string[]>
}
export interface IAddFavorite {
    execute(productId: string, userId: string): Promise<void>
}
export interface IRemoveFavorite {
    execute(productId: string, userId: string): Promise<void>
}
export interface IMergeFavorites {
    execute(productIds: string[], userId: string): Promise<MergeFavoritesResult>
}