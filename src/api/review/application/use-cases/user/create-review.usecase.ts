import {
  IReviewRepository, Review, ReviewAlreadyExistsError, ReviewProductNotFoundError,
  ReviewPurchaseRequiredError,
} from '@api/review/domain'
import { ILogger } from '@common/logger'

import { CreateReviewCommand, ICreateReview } from '../../interfaces'
import { IPurchaseVerifier, IReviewPolicy, IReviewProductCatalog } from '../../ports'
import { RatingRefresher } from '../../services'

export default class CreateReviewUseCase implements ICreateReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly catalog: IReviewProductCatalog,
    private readonly purchases: IPurchaseVerifier,
    private readonly policy: IReviewPolicy,
    private readonly refresher: RatingRefresher,
    private readonly logger: ILogger,
  ) {}

  async execute(command: CreateReviewCommand, userId: string): Promise<Review> {
    if (!(await this.catalog.isPublished(command.productId))) {
      throw new ReviewProductNotFoundError(command.productId)
    }

    const purchased = await this.purchases.hasPurchased(userId, command.productId)
    if (this.policy.requiresPurchase() && !purchased) throw new ReviewPurchaseRequiredError()

    if (await this.reviews.findByUserAndProduct(userId, command.productId)) {
      throw new ReviewAlreadyExistsError()
    }

    const review = Review.create({
      productId: command.productId,
      userId,
      rating: command.rating,
      comment: command.comment,
      displayName: command.displayName,
      isVerifiedPurchase: purchased,
    })
    if (!(await this.reviews.create(review))) throw new ReviewAlreadyExistsError()

    await this.refresher.refresh(review.productId)

    void this.logger.info('Review created', {
      module: 'CreateReviewUseCase',
      operation: 'execute',
      event: 'review.create',
      userId,
      resourceId: review.id,
      data: { productId: review.productId, rating: review.rating },
    })
    return review
  }
}
