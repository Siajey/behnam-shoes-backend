import { RatingSummary, Review } from '@api/review/domain'

export interface CreateReviewCommand {
  productId: string
  rating: number
  comment?: string
  displayName?: string
}

export interface EditReviewCommand {
  reviewId: string
  rating?: number
  comment?: string | null
  displayName?: string | null
}

export interface ListProductReviewsCommand {
  productId: string
  rating?: number
  cursor?: string
  pageSize: number
}

export interface ProductReviewsResult {
  summary: RatingSummary
  reviews: Review[]
  nextCursor: string | null
}

export interface MyProductReview {
  review: Review | null
  canReview: boolean
}

export interface ICreateReview {
  execute(command: CreateReviewCommand, userId: string): Promise<Review>
}
export interface IEditReview {
  execute(command: EditReviewCommand, userId: string): Promise<Review>
}
export interface IDeleteMyReview {
  execute(reviewId: string, userId: string): Promise<void>
}
export interface IListProductReviews {
  execute(command: ListProductReviewsCommand): Promise<ProductReviewsResult>
}
export interface IGetMyProductReview {
  execute(productId: string, userId: string): Promise<MyProductReview>
}
