import { NotFoundError, ValidationError } from '@common/errors'

export class FavoriteLimitReachedError extends ValidationError {
    constructor(max: number) {
        super({
            message: 'errors.favorites.limitReached',
            code: 'FAVORITE_LIMIT_REACHED',
            details: { max },
        })
    }
}

export class FavoriteProductNotFoundError extends NotFoundError {
    constructor(productId: string) {
        super({
            message: 'errors.favorites.productNotFound',
            code: 'FAVORITE_PRODUCT_NOT_FOUND',
            details: { productId },
        })
    }
}