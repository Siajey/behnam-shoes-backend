import { Inject, Injectable } from '@nestjs/common'

import { IGetPublishedProductsByIds } from '@api/product/application'
import { GET_PUBLISHED_PRODUCTS_BY_IDS } from '@common/di'
import { IReviewProductCatalog } from '@api/review/application'

@Injectable()
export class ProductCatalogReviews implements IReviewProductCatalog {
  constructor(
    @Inject(GET_PUBLISHED_PRODUCTS_BY_IDS) private readonly getPublished: IGetPublishedProductsByIds,
  ) {}

  async isPublished(productId: string): Promise<boolean> {
    const found = await this.getPublished.execute([productId])
    return found.length > 0
  }
}
