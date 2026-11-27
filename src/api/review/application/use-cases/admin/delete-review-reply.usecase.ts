import {
  IReviewRepository, Review, ReviewNotFoundError, ReviewReplyNotFoundError,
} from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IDeleteReviewReply } from '../../interfaces'

export default class DeleteReviewReplyUseCase implements IDeleteReviewReply {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(reviewId: string, actorId: string): Promise<Review> {
    const review = await this.reviews.findById(reviewId)
    if (!review) throw new ReviewNotFoundError({ reviewId })
    if (!review.removeReply()) throw new ReviewReplyNotFoundError()

    await this.reviews.save(review)

    void this.logger.info('Review answer removed', {
      module: 'DeleteReviewReplyUseCase',
      operation: 'execute',
      event: 'review.admin.reply.delete',
      userId: actorId,
      resourceId: review.id,
    })
    return review
  }
}
