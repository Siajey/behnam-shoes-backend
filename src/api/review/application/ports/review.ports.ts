export interface IReviewProductCatalog {
  isPublished(productId: string): Promise<boolean>
}

export interface IPurchaseVerifier {
  hasPurchased(userId: string, productId: string): Promise<boolean>
}

export interface IRatingPublisher {
  publish(productId: string, average: number, count: number): Promise<void>
}

export interface IReviewPolicy {
  requiresPurchase(): boolean
}
