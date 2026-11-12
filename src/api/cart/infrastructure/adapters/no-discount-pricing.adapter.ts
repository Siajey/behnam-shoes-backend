import { Injectable } from '@nestjs/common'

import { PricingResult } from '@api/cart/domain'
import { IPricingService, PricingRequest } from '@api/cart/application'

@Injectable()
export class NoDiscountPricingService implements IPricingService {
    async price(request: PricingRequest): Promise<PricingResult> {
        return {
            lines: request.lines.map((l) => ({
                variantId: l.variantId,
                originalUnitPrice: l.unitPrice,
                unitPrice: l.unitPrice,
                couponAllocation: 0,
            })),
            couponCode: null,
            couponStatus: 'none',
            couponDiscount: 0,
        }
    }
}