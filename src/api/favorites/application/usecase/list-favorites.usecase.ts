import { IFavoriteRepository } from '@api/favorites/domain'

import { DEFAULT_FAVORITES_PAGE_SIZE, paginateFavorites } from '../helpers'
import { FavoritesPage, IListFavorites, ListFavoritesQuery } from '../interfaces'
import { IFavoriteProductCatalog } from '../ports'

export default class ListFavoritesUseCase implements IListFavorites {
    constructor(
        private readonly favorites: IFavoriteRepository,
        private readonly catalog: IFavoriteProductCatalog,
    ) {}

    async execute(userId: string, query: ListFavoritesQuery): Promise<FavoritesPage> {
        const all = await this.favorites.listByUserId(userId)
        const published = new Set(await this.catalog.findPublishedIds(all.map((f) => f.productId)))
        const visible = all.filter((f) => published.has(f.productId))

        const page = paginateFavorites(visible, query.pageSize ?? DEFAULT_FAVORITES_PAGE_SIZE, query.nextCursor)
        const summaries = new Map(
            (await this.catalog.findSummaries(page.items.map((f) => f.productId))).map((s) => [s.id, s]),
        )

        return {
            items: page.items.flatMap((f) => {
                const summary = summaries.get(f.productId)
                return summary ? [{ ...summary, favoritedAt: f.createdAt }] : []
            }),
            nextCursor: page.nextCursor,
        }
    }
}