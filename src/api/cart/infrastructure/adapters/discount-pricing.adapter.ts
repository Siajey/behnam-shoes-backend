import { Inject, Injectable } from '@nestjs/common'
import { IPriceItems } from '@api/discount/application'
import { PRICE_ITEMS } from '@common/di'

import { PricingResult } from '@api/cart/domain'
import { IPricingService, PricingRequest } from '../../application/ports'

@Injectable()
export class DiscountPricingService implements IPricingService {
    constructor(@Inject(PRICE_ITEMS) private readonly priceItems: IPriceItems) {}

    async price(request: PricingRequest): Promise<PricingResult> {
        const result = await this.priceItems.execute({
            userId: request.userId,
            lines: request.lines,
            couponCode: request.couponCode,
        })

        const coupon = result.coupon
        return {
            lines: result.lines.map((l) => ({
                variantId: l.variantId,
                originalUnitPrice: l.originalUnitPrice,
                unitPrice: l.unitPrice,
                couponAllocation: l.couponAllocation,
            })),
            couponCode: coupon.status === 'none' ? null : coupon.code,
            couponStatus: coupon.status,
            couponInvalidReason: coupon.status === 'invalid' ? coupon.reason : null,
            couponDiscount: coupon.status === 'applied' ? coupon.discount : 0,
        }
    }
}