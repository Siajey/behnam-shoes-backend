import { IFavoriteRepository } from '@api/favorites/domain'

import { IListFavoriteIds } from '../interfaces'
import { IFavoriteProductCatalog } from '../ports'

export default class ListFavoriteIdsUseCase implements IListFavoriteIds {
    constructor(
        private readonly favorites: IFavoriteRepository,
        private readonly catalog: IFavoriteProductCatalog,
    ) {}

    async execute(userId: string): Promise<string[]> {
        const ids = (await this.favorites.listByUserId(userId)).map((f) => f.productId)
        const published = new Set(await this.catalog.findPublishedIds(ids))
        return ids.filter((id) => published.has(id))
    }
}