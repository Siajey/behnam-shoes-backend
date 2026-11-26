import { Review } from '../entities'
import { RatingSummary } from '../value-objects'

export interface ReviewListQuery {
  productId?: string
  rating?: number
  hasReply?: boolean
  cursor?: { createdAt: Date; id: string } | null
  limit: number
}

export interface IReviewRepository {
  findById(id: string): Promise<Review | null>
  findByUserAndProduct(userId: string, productId: string): Promise<Review | null>
  create(review: Review): Promise<boolean>
  save(review: Review): Promise<void>
  delete(id: string): Promise<void>
  list(query: ReviewListQuery): Promise<Review[]>
  summary(productId: string): Promise<RatingSummary>
  allSummaries(): Promise<{ productId: string; average: number; count: number }[]>
}
