import {
    COMMIT_COUPON_REDEMPTION, COUPON_REDEMPTION_REPOSITORY, COUPON_REPOSITORY, createProvider,
    DISCOUNT_REPOSITORY, PRICE_ITEMS, RELEASE_COUPON_REDEMPTION, RESERVE_COUPON,
} from '@common/di'

import {
    CommitCouponRedemptionUseCase, PriceItemsUseCase, ReleaseCouponRedemptionUseCase,
    ReserveCouponUseCase,
} from '@api/discount/application'

export const DiscountSystemUseCaseProviders = [
    createProvider<PriceItemsUseCase>(PRICE_ITEMS, PriceItemsUseCase, [
        DISCOUNT_REPOSITORY, COUPON_REPOSITORY, COUPON_REDEMPTION_REPOSITORY,
    ]),
    createProvider<ReserveCouponUseCase>(RESERVE_COUPON, ReserveCouponUseCase, [COUPON_REDEMPTION_REPOSITORY]),
    createProvider<CommitCouponRedemptionUseCase>(
        COMMIT_COUPON_REDEMPTION, CommitCouponRedemptionUseCase, [COUPON_REDEMPTION_REPOSITORY],
    ),
    createProvider<ReleaseCouponRedemptionUseCase>(
        RELEASE_COUPON_REDEMPTION, ReleaseCouponRedemptionUseCase, [COUPON_REDEMPTION_REPOSITORY],
    ),
]