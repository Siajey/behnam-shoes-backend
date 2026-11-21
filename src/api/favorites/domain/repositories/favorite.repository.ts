import {Favorite} from '../entities'
import {ProductFavoriteCount} from "./product-favorite-count.contract"

export interface IFavoriteRepository {
    listByUserId(userId: string): Promise<Favorite[]>

    add(favorites: Favorite[]): Promise<number>

    remove(userId: string, productId: string): Promise<void>

    countByProductSince(since: Date): Promise<ProductFavoriteCount[]>

}