// Section: 3. Infrastructure / adapters
// `product-rating-publisher.adapter.ts`:

import { Inject, Injectable } from '@nestjs/common'
import { IUpsertProductRating } from '@api/product/application'
import { UPSERT_PRODUCT_RATING } from '@common/di'

import { IRatingPublisher } from '@api/review/application'

@Injectable()
export class ProductRatingPublisher implements IRatingPublisher {
  constructor(@Inject(UPSERT_PRODUCT_RATING) private readonly upsertRating: IUpsertProductRating) {}

  publish(productId: string, average: number, count: number): Promise<void> {
    return this.upsertRating.execute({ productId, average, count })
  }
}
