export interface IUpsertProductRating {
  execute(command: { productId: string; average: number; count: number }): Promise<void>
}
