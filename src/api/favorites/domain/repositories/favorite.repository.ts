import { Favorite } from '../entities'

export interface IFavoriteRepository {
    listByUserId(userId: string): Promise<Favorite[]>

    add(favorites: Favorite[]): Promise<number>

    remove(userId: string, productId: string): Promise<void>
}