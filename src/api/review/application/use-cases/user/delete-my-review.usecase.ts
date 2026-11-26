import { IReviewRepository, ReviewNotFoundError } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IDeleteMyReview } from '../../interfaces'
import { RatingRefresher } from '../../services'

export default class DeleteMyReviewUseCase implements IDeleteMyReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly refresher: RatingRefresher,
    private readonly logger: ILogger,
  ) {}

  async execute(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviews.findById(reviewId)
    if (!review || review.userId !== userId) throw new ReviewNotFoundError({ reviewId })

    await this.reviews.delete(review.id)
    await this.refresher.refresh(review.productId)

    void this.logger.info('Review deleted by its author', {
      module: 'DeleteMyReviewUseCase',
      operation: 'execute',
      event: 'review.delete',
      userId,
      resourceId: review.id,
    })
  }
}
