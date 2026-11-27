import { IProductRatingRepository } from '@api/product/domain'

import { IUpsertProductRating } from '../../interfaces'

export default class UpsertProductRatingUseCase implements IUpsertProductRating {
  constructor(private readonly ratings: IProductRatingRepository) {}

  async execute(command: { productId: string; average: number; count: number }): Promise<void> {
    await this.ratings.upsert(command.productId, command.average, command.count)
  }
}
