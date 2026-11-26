import { IReviewRepository, Review, ReviewNotFoundError } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { EditReviewCommand, IEditReview } from '../../interfaces'
import { RatingRefresher } from '../../services'

export default class EditReviewUseCase implements IEditReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly refresher: RatingRefresher,
    private readonly logger: ILogger,
  ) {}

  async execute(command: EditReviewCommand, userId: string): Promise<Review> {
    const review = await this.reviews.findById(command.reviewId)
    if (!review || review.userId !== userId) throw new ReviewNotFoundError({ reviewId: command.reviewId })

    const ratingChanged = review.edit({
      rating: command.rating,
      comment: command.comment,
      displayName: command.displayName,
    })
    await this.reviews.save(review)
    if (ratingChanged) await this.refresher.refresh(review.productId)

    void this.logger.info('Review edited', {
      module: 'EditReviewUseCase',
      operation: 'execute',
      event: 'review.edit',
      userId,
      resourceId: review.id,
    })
    return review
  }
}
