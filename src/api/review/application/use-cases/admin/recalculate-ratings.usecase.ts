import { IReviewRepository } from '@api/review/domain'
import { ILogger } from '@common/logger'

import { IRecalculateRatings } from '../../interfaces'
import { IRatingPublisher } from '../../ports'

export default class RecalculateRatingsUseCase implements IRecalculateRatings {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly publisher: IRatingPublisher,
    private readonly logger: ILogger,
  ) {}

  async execute(actorId: string): Promise<{ products: number }> {
    const summaries = await this.reviews.allSummaries()
    for (const s of summaries) await this.publisher.publish(s.productId, s.average, s.count)

    void this.logger.info('Product ratings recalculated', {
      module: 'RecalculateRatingsUseCase',
      operation: 'execute',
      event: 'review.rating.recalculate',
      userId: actorId,
      data: { products: summaries.length },
    })
    return { products: summaries.length }
  }
}
