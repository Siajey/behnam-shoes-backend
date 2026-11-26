export interface ProductRating {
  average: number
  count: number
}

export interface IProductRatingRepository {
  upsert(productId: string, average: number, count: number): Promise<void>
  findByProductIds(productIds: string[]): Promise<Map<string, ProductRating>>
}
