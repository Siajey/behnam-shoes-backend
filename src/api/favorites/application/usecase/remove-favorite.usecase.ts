import { IFavoriteRepository } from '@api/favorites/domain'

import { IRemoveFavorite } from '../interfaces'

export default class RemoveFavoriteUseCase implements IRemoveFavorite {
    constructor(private readonly favorites: IFavoriteRepository) {}

    execute(productId: string, userId: string): Promise<void> {
        return this.favorites.remove(userId, productId)
    }
}