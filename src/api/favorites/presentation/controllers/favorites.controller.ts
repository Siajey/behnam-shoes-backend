import {Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {ReqUser} from '@common/decorator'
import {CSRFGuard, JwtSessionGuard} from '@api/session/presentation'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {
    ADD_FAVORITE,
    LIST_FAVORITE_IDS,
    LIST_FAVORITES,
    MERGE_FAVORITES,
    REMOVE_FAVORITE,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {
    IAddFavorite,
    IListFavoriteIds,
    IListFavorites,
    IMergeFavorites,
    IRemoveFavorite,
} from '@api/favorites/application'
import {
    ListFavoritesQueryDto,
    ListFavoritesQuerySchema,
    MergeFavoritesBody,
    MergeFavoritesSchema,
} from '../dto'
import {FavoritePresenter} from '../presenters'

const productIdPipe = new ZodValidationPipe(uuidSchema)

@Controller('favorites')
@UseGuards(CSRFGuard, JwtSessionGuard)
@Throttle({default: {ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 120 : 10_000}})
export default class FavoritesController {
    constructor(
        @Inject(LIST_FAVORITES) private readonly listFavorites: IListFavorites,
        @Inject(LIST_FAVORITE_IDS) private readonly listIds: IListFavoriteIds,
        @Inject(ADD_FAVORITE) private readonly addFavorite: IAddFavorite,
        @Inject(REMOVE_FAVORITE) private readonly removeFavorite: IRemoveFavorite,
        @Inject(MERGE_FAVORITES) private readonly mergeFavorites: IMergeFavorites,
    ) {
    }

    @Get()
    async listController(
        @Query(new ZodValidationPipe(ListFavoritesQuerySchema)) query: ListFavoritesQueryDto,
        @ReqUser() user: User,
    ) {
        const page = await this.listFavorites.execute(user.id, query)
        return new SuccessResponse({
            messageObj: {message: 'common.favorites.listSuccess'},
            code: 'FAVORITES_LIST_SUCCESS',
            path: '/favorites',
            data: {items: page.items.map(FavoritePresenter.item), nextCursor: page.nextCursor},
        })
    }

    @Get('ids')
    async idsController(@ReqUser() user: User) {
        return new SuccessResponse({
            messageObj: {message: 'common.favorites.idsSuccess'},
            code: 'FAVORITES_IDS_SUCCESS',
            path: '/favorites/ids',
            data: {productIds: await this.listIds.execute(user.id)},
        })
    }

    @Put(':productId')
    async addController(@Param('productId', productIdPipe) productId: string, @ReqUser() user: User) {
        await this.addFavorite.execute(productId, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.favorites.addSuccess'},
            code: 'FAVORITES_ADD_SUCCESS',
            path: `/favorites/${productId}`,
            data: {productId, favorited: true},
        })
    }

    @Delete(':productId')
    async removeController(@Param('productId', productIdPipe) productId: string, @ReqUser() user: User) {
        await this.removeFavorite.execute(productId, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.favorites.removeSuccess'},
            code: 'FAVORITES_REMOVE_SUCCESS',
            path: `/favorites/${productId}`,
            data: {productId, favorited: false},
        })
    }

    @Post('merge')
    async mergeController(
        @Body(new ZodValidationPipe(MergeFavoritesSchema)) body: MergeFavoritesBody,
        @ReqUser() user: User,
    ) {
        const result = await this.mergeFavorites.execute(body.productIds, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.favorites.mergeSuccess'},
            code: 'FAVORITES_MERGE_SUCCESS',
            path: '/favorites/merge',
            data: result,
        })
    }
}