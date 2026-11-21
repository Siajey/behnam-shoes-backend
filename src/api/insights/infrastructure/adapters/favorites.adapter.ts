import {Inject, Injectable} from '@nestjs/common'

import {IGetRecentFavoriteCounts} from '@api/favorites/application'
import {GET_RECENT_FAVORITE_COUNTS} from '@common/di'

import {IProductFavoritesSource, ProductFavoritesRow} from '../../application'

@Injectable()
export class FavoritesSource implements IProductFavoritesSource {
    constructor(
        @Inject(GET_RECENT_FAVORITE_COUNTS) private readonly getCounts: IGetRecentFavoriteCounts) {
    }

    async favoritesAddedSince(since: Date): Promise<ProductFavoritesRow[]> {
        const rows = await this.getCounts.execute(since);
        return rows.map((r) => ({productId: r.productId, favoritesAdded: r.count}))
    }
}
