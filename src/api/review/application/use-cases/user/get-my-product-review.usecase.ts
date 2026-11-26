import { IReviewRepository, ReviewProductNotFoundError } from '@api/review/domain'

import { IGetMyProductReview, MyProductReview } from '../../interfaces'
import { IPurchaseVerifier, IReviewPolicy, IReviewProductCatalog } from '../../ports'

export default class GetMyProductReviewUseCase implements IGetMyProductReview {
  constructor(
    private readonly reviews: IReviewRepository,
    private readonly catalog: IReviewProductCatalog,
    private readonly purchases: IPurchaseVerifier,
    private readonly policy: IReviewPolicy,
  ) {}

  async execute(productId: string, userId: string): Promise<MyProductReview> {
    if (!(await this.catalog.isPublished(productId))) throw new ReviewProductNotFoundError(productId)

    const review = await this.reviews.findByUserAndProduct(userId, productId)
    if (review) return { review, canReview: false }

    const canReview = this.policy.requiresPurchase()
      ? await this.purchases.hasPurchased(userId, productId)
      : true
    return { review: null, canReview }
  }
}
