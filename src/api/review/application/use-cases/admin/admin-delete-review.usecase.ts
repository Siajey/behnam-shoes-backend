import { IReviewRepository, ReviewNotFoundError } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IAdminDeleteReview } from '../../interfaces'
import { RatingRefresher } from '../../services'

export default class AdminDeleteReviewUseCase implements IAdminDeleteReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly refresher: RatingRefresher,
    private readonly logger: ILogger,
  ) {}

  async execute(reviewId: string, actorId: string): Promise<void> {
    const review = await this.reviews.findById(reviewId)
    if (!review) throw new ReviewNotFoundError({ reviewId })

    await this.reviews.delete(review.id)
    await this.refresher.refresh(review.productId)

    void this.logger.info('Review deleted by an admin', {
      module: 'AdminDeleteReviewUseCase',
      operation: 'execute',
      event: 'review.admin.delete',
      userId: actorId,
      resourceId: review.id,
      data: { productId: review.productId, authorId: review.userId },
    })
  }
}
