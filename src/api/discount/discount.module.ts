import {Module} from '@nestjs/common'

import {AuthModule} from '@api/auth'
import {SessionModule} from '@api/session'
import {DatabaseModule} from '@common/db'
import {
    COMMIT_COUPON_REDEMPTION,
    COUPON_REDEMPTION_REPOSITORY,
    COUPON_REPOSITORY,
    DISCOUNT_REPOSITORY,
    PRICE_ITEMS,
    RELEASE_COUPON_REDEMPTION,
    RESERVE_COUPON,
} from '@common/di'

import {
    CouponRedemptionRepository,
    CouponRepository,
    DiscountAdminUseCaseProviders,
    DiscountRepository,
    DiscountSystemUseCaseProviders,
} from './infrastructure'
import {AdminCouponController, AdminDiscountController} from './presentation'

@Module({
    imports: [DatabaseModule, SessionModule, AuthModule],
    controllers: [AdminDiscountController, AdminCouponController],
    providers: [
        {provide: DISCOUNT_REPOSITORY, useClass: DiscountRepository},
        {provide: COUPON_REPOSITORY, useClass: CouponRepository},
        {provide: COUPON_REDEMPTION_REPOSITORY, useClass: CouponRedemptionRepository},
        ...DiscountAdminUseCaseProviders,
        ...DiscountSystemUseCaseProviders,
    ],
    exports: [PRICE_ITEMS, RESERVE_COUPON, COMMIT_COUPON_REDEMPTION, RELEASE_COUPON_REDEMPTION],
})
export class DiscountModule {
}