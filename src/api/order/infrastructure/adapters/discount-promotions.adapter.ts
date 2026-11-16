import { Inject, Injectable } from '@nestjs/common'
import {
  ICommitCouponRedemption, IPriceItems, IReleaseCouponRedemption, IReserveCoupon,
} from '@api/discount/application'
import {
  COMMIT_COUPON_REDEMPTION, PRICE_ITEMS, RELEASE_COUPON_REDEMPTION, RESERVE_COUPON,
} from '@common/di'

import { IOrderPromotions, PromotionLine, PromotionResult } from '../../application/ports'

@Injectable()
export class DiscountPromotions implements IOrderPromotions {
  constructor(
    @Inject(PRICE_ITEMS) private readonly priceItems: IPriceItems,
    @Inject(RESERVE_COUPON) private readonly reserve: IReserveCoupon,
    @Inject(COMMIT_COUPON_REDEMPTION) private readonly commit: ICommitCouponRedemption,
    @Inject(RELEASE_COUPON_REDEMPTION) private readonly release: IReleaseCouponRedemption,
  ) {}

  async price(input: {
    userId: string
    lines: PromotionLine[]
    couponCode: string | null
  }): Promise<PromotionResult> {
    const result = await this.priceItems.execute(input)
    const c = result.coupon

    return {
      lines: result.lines.map((l) => ({
        variantId: l.variantId,
        originalUnitPrice: l.originalUnitPrice,
        unitPrice: l.unitPrice,
        couponAllocation: l.couponAllocation,
      })),
      coupon:
        c.status === 'applied'
          ? { status: 'applied', couponId: c.couponId, code: c.code, discount: c.discount }
          : c.status === 'invalid'
            ? { status: 'invalid', reason: c.reason }
            : { status: 'none' },
    }
  }

  reserveCoupon(input: {
    couponId: string
    userId: string
    orderId: string
    discountAmount: number
  }): Promise<void> {
    return this.reserve.execute(input)
  }

  commitCoupon(orderId: string): Promise<void> {
    return this.commit.execute(orderId)
  }

  releaseCoupon(orderId: string): Promise<void> {
    return this.release.execute(orderId)
  }
}
