import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards,} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {
    ICreateReview,
    IDeleteMyReview,
    IEditReview,
    IGetMyProductReview,
    IListProductReviews,
} from '@api/review/application'
import {CSRFGuard, JwtSessionGuard} from '@api/session/presentation'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {ReqUser} from '@common/decorator'
import {CREATE_REVIEW, DELETE_MY_REVIEW, EDIT_REVIEW, GET_MY_PRODUCT_REVIEW, LIST_PRODUCT_REVIEWS,} from '@common/di'
import {ZodValidationPipe} from '@common/validations'

import {
    CreateReviewBody,
    CreateReviewSchema,
    EditReviewBody,
    EditReviewSchema,
    ListReviewsQuery,
    ListReviewsQuerySchema,
    ProductIdParamSchema,
} from '../dto'
import {ReviewPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(ProductIdParamSchema)

@Controller()
@Throttle({default: {ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 60 : 10_000}})
export default class ReviewController {
    constructor(
        @Inject(LIST_PRODUCT_REVIEWS) private readonly listReviews: IListProductReviews,
        @Inject(GET_MY_PRODUCT_REVIEW) private readonly getMyReview: IGetMyProductReview,
        @Inject(CREATE_REVIEW) private readonly createReview: ICreateReview,
        @Inject(EDIT_REVIEW) private readonly editReview: IEditReview,
        @Inject(DELETE_MY_REVIEW) private readonly deleteMyReview: IDeleteMyReview,
    ) {
    }

    @Get('products/:productId/reviews')
    async listController(
        @Param('productId', idPipe) productId: string,
        @Query(new ZodValidationPipe(ListReviewsQuerySchema)) query: ListReviewsQuery,
    ) {
        const result = await this.listReviews.execute({productId, ...query})
        return new SuccessResponse({
            messageObj: {message: 'common.review.listSuccess'},
            code: 'REVIEW_LIST_SUCCESS',
            path: `/products/${productId}/reviews`,
            data: {
                summary: ReviewPresenter.summary(result.summary),
                items: result.reviews.map(ReviewPresenter.item),
                nextCursor: result.nextCursor,
            },
        })
    }

    @Get('products/:productId/reviews/me')
    @UseGuards(JwtSessionGuard)
    async meController(@Param('productId', idPipe) productId: string, @ReqUser() user: User) {
        const result = await this.getMyReview.execute(productId, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.meSuccess'},
            code: 'REVIEW_ME_SUCCESS',
            path: `/products/${productId}/reviews/me`,
            data: {
                canReview: result.canReview,
                review: result.review ? ReviewPresenter.item(result.review) : null,
            },
        })
    }

    @Post('products/:productId/reviews')
    @UseGuards(CSRFGuard, JwtSessionGuard)
    async createController(
        @Param('productId', idPipe) productId: string,
        @Body(new ZodValidationPipe(CreateReviewSchema)) body: CreateReviewBody,
        @ReqUser() user: User,
    ) {
        const review = await this.createReview.execute({productId, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.createSuccess'},
            code: 'REVIEW_CREATE_SUCCESS',
            path: `/products/${productId}/reviews`,
            status: HttpStatus.CREATED,
            data: ReviewPresenter.item(review),
        })
    }

    @Patch('reviews/:id')
    @UseGuards(CSRFGuard, JwtSessionGuard)
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditReviewSchema)) body: EditReviewBody,
        @ReqUser() user: User,
    ) {
        const review = await this.editReview.execute({reviewId: id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.editSuccess'},
            code: 'REVIEW_EDIT_SUCCESS',
            path: `/reviews/${id}`,
            data: ReviewPresenter.item(review),
        })
    }

    @Delete('reviews/:id')
    @UseGuards(CSRFGuard, JwtSessionGuard)
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteMyReview.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.deleteSuccess'},
            code: 'REVIEW_DELETE_SUCCESS',
            path: `/reviews/${id}`,
            data: null,
        })
    }
}
