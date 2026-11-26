import { IReviewRepository, Review, ReviewNotFoundError } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IReplyToReview } from '../../interfaces'

export default class ReplyToReviewUseCase implements IReplyToReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: { reviewId: string; text: string }, actorId: string): Promise<Review> {
    const review = await this.reviews.findById(command.reviewId)
    if (!review) throw new ReviewNotFoundError({ reviewId: command.reviewId })

    review.answer(command.text, actorId)
    await this.reviews.save(review)

    void this.logger.info('Review answered', {
      module: 'ReplyToReviewUseCase',
      operation: 'execute',
      event: 'review.admin.reply',
      userId: actorId,
      resourceId: review.id,
    })
    return review
  }
}
