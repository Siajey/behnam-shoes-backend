import {Body, Controller, Delete, Get, Inject, Param, Post, Put, Query} from '@nestjs/common'

import {
    IAdminDeleteReview,
    IAdminListReviews,
    IDeleteReviewReply,
    IRecalculateRatings,
    IReplyToReview,
} from '@api/review/application'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {AdminOnly, AdminWriteOnly, ReqUser} from '@common/decorator'
import {
    ADMIN_DELETE_REVIEW,
    ADMIN_LIST_REVIEWS,
    DELETE_REVIEW_REPLY,
    RECALCULATE_RATINGS,
    REPLY_TO_REVIEW,
} from '@common/di'
import {ZodValidationPipe} from '@common/validations'

import {
    AdminListReviewsQuery,
    AdminListReviewsQuerySchema,
    ProductIdParamSchema,
    ReplyReviewBody,
    ReplyReviewSchema,
} from '../dto'
import {ReviewPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(ProductIdParamSchema)

@Controller('admin/reviews')
export default class AdminReviewController {
    constructor(
        @Inject(ADMIN_LIST_REVIEWS) private readonly listReviews: IAdminListReviews,
        @Inject(ADMIN_DELETE_REVIEW) private readonly deleteReview: IAdminDeleteReview,
        @Inject(REPLY_TO_REVIEW) private readonly replyToReview: IReplyToReview,
        @Inject(DELETE_REVIEW_REPLY) private readonly deleteReply: IDeleteReviewReply,
        @Inject(RECALCULATE_RATINGS) private readonly recalculate: IRecalculateRatings,
    ) {
    }

    @Get()
    @AdminOnly()
    async listController(
        @Query(new ZodValidationPipe(AdminListReviewsQuerySchema)) query: AdminListReviewsQuery,
    ) {
        const page = await this.listReviews.execute(query)
        return new SuccessResponse({
            messageObj: {message: 'common.review.adminListSuccess'},
            code: 'REVIEW_ADMIN_LIST_SUCCESS',
            path: '/admin/reviews',
            data: {
                items: page.reviews.map(ReviewPresenter.adminItem),
                nextCursor: page.nextCursor
            },
        })
    }

    @Post('recalculate-ratings')
    @AdminWriteOnly()
    async recalculateController(@ReqUser() user: User) {
        return new SuccessResponse({
            messageObj: {message: 'common.review.recalculateSuccess'},
            code: 'REVIEW_RECALCULATE_SUCCESS',
            path: '/admin/reviews/recalculate-ratings',
            data: await this.recalculate.execute(user.id),
        })
    }

    @Put(':id/reply')
    @AdminWriteOnly()
    async replyController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(ReplyReviewSchema)) body: ReplyReviewBody,
        @ReqUser() user: User,
    ) {
        const review = await this.replyToReview.execute({reviewId: id, text: body.text}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.replySuccess'},
            code: 'REVIEW_REPLY_SUCCESS',
            path: `/admin/reviews/${id}/reply`,
            data: ReviewPresenter.adminItem(review),
        })
    }

    @Delete(':id/reply')
    @AdminWriteOnly()
    async deleteReplyController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        const review = await this.deleteReply.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.replyDeleteSuccess'},
            code: 'REVIEW_REPLY_DELETE_SUCCESS',
            path: `/admin/reviews/${id}/reply`,
            data: ReviewPresenter.adminItem(review),
        })
    }

    @Delete(':id')
    @AdminWriteOnly()
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteReview.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.review.adminDeleteSuccess'},
            code: 'REVIEW_ADMIN_DELETE_SUCCESS',
            path: `/admin/reviews/${id}`,
            data: null,
        })
    }
}
