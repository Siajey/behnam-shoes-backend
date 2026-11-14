import { ICouponRedemptionRepository } from '@api/discount/domain'

import { ICommitCouponRedemption } from '../../interfaces'

export default class CommitCouponRedemptionUseCase implements ICommitCouponRedemption {
    constructor(private readonly redemptions: ICouponRedemptionRepository) {}

    execute(orderId: string): Promise<void> {
        return this.redemptions.commit(orderId)
    }
}