import { IFavoriteRepository, ProductFavoriteCount } from '@api/favorites/domain'

import { IGetRecentFavoriteCounts } from '../interfaces'

export default class GetRecentFavoriteCountsUseCase implements IGetRecentFavoriteCounts {
    constructor(private readonly favorites: IFavoriteRepository) {}
    execute(since: Date): Promise<ProductFavoriteCount[]> { return this.favorites.countByProductSince(since) }
}
