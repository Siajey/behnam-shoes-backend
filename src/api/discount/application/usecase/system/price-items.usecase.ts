import {
    Coupon, CouponContext, ICouponRedemptionRepository, ICouponRepository, IDiscountRepository,
    priceLines,
} from '@api/discount/domain'

import { IPriceItems, PriceItemsCommand, PriceItemsResult } from '../../interfaces'

export default class PriceItemsUseCase implements IPriceItems {
    constructor(
        private readonly discounts: IDiscountRepository,
        private readonly coupons: ICouponRepository,
        private readonly redemptions: ICouponRedemptionRepository,
    ) {}

    async execute(command: PriceItemsCommand): Promise<PriceItemsResult> {
        const now = new Date()
        const discounts = command.lines.length > 0 ? await this.discounts.findActiveAt(now) : []

        let couponCode: string | null = null
        let couponContext: CouponContext | null = null

        if (command.couponCode) {
            couponCode = Coupon.normalizeCode(command.couponCode)
            const coupon = await this.coupons.findByCode(couponCode)
            couponContext = {
                coupon,
                usage: coupon
                    ? {
                        total: await this.redemptions.countActive(coupon.id),
                        user: await this.redemptions.countActiveForUser(coupon.id, command.userId),
                    }
                    : { total: 0, user: 0 },
            }
        }

        return priceLines({ lines: command.lines, discounts, couponCode, couponContext, now })
    }
}