import { IReviewRepository } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IRatingPublisher } from '../ports'

export class RatingRefresher {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly publisher: IRatingPublisher,
    private readonly logger: ILogger,
  ) {}

  async refresh(productId: string): Promise<void> {
    try {
      const summary = await this.reviews.summary(productId)
      await this.publisher.publish(productId, summary.average, summary.count)
    } catch (error) {
      void this.logger.warn('The product rating could not be updated, it stays as it was', {
        module: 'RatingRefresher',
        operation: 'refresh',
        event: 'review.rating.refresh',
        data: { productId },
        err: error,
      })
    }
  }
}
