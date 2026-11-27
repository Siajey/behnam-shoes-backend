import { Module } from '@nestjs/common'

import { OrderModule } from '@api/order/order.module'
import { ProductModule } from '@api/product/product.module'
import { SessionModule } from '@api/session'
import { DatabaseModule } from '@common/db'
import {
  REVIEW_POLICY, REVIEW_PRODUCT_CATALOG, REVIEW_PURCHASE_VERIFIER, REVIEW_RATING_PUBLISHER,
  REVIEW_REPOSITORY,
} from '@common/di'

import {
  ConfigReviewPolicy, OrderPurchaseVerifier, ProductCatalogReviews, ProductRatingPublisher,
  ReviewRepository, ReviewUseCaseProviders,
} from './infrastructure'
import { AdminReviewController, ReviewController } from './presentation'

@Module({
  imports: [DatabaseModule, ProductModule, OrderModule, SessionModule, SessionModule],
  controllers: [ReviewController, AdminReviewController],
  providers: [
    { provide: REVIEW_REPOSITORY, useClass: ReviewRepository },
    { provide: REVIEW_POLICY, useClass: ConfigReviewPolicy },
    { provide: REVIEW_PRODUCT_CATALOG, useClass: ProductCatalogReviews },
    { provide: REVIEW_PURCHASE_VERIFIER, useClass: OrderPurchaseVerifier },
    { provide: REVIEW_RATING_PUBLISHER, useClass: ProductRatingPublisher },
    ...ReviewUseCaseProviders,
  ],
})
export class ReviewModule {}
