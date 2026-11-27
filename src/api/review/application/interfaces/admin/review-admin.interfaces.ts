import { Review } from '@api/review/domain'

export interface AdminListReviewsCommand {
  productId?: string
  rating?: number
  hasReply?: boolean
  nextCursor?: string
  pageSize: number
}

export interface AdminReviewPage {
  reviews: Review[]
  nextCursor: string | null
}

export interface IAdminListReviews {
  execute(command: AdminListReviewsCommand): Promise<AdminReviewPage>
}
export interface IAdminDeleteReview {
  execute(reviewId: string, actorId: string): Promise<void>
}
export interface IReplyToReview {
  execute(command: { reviewId: string; text: string }, actorId: string): Promise<Review>
}
export interface IDeleteReviewReply {
  execute(reviewId: string, actorId: string): Promise<Review>
}
export interface IRecalculateRatings {
  execute(actorId: string): Promise<{ products: number }>
}
