import { ICouponRedemptionRepository } from '@api/discount/domain'

import { IReleaseCouponRedemption } from '../../interfaces'

export default class ReleaseCouponRedemptionUseCase implements IReleaseCouponRedemption {
    constructor(private readonly redemptions: ICouponRedemptionRepository) {}

    execute(orderId: string): Promise<void> {
        return this.redemptions.release(orderId)
    }
}