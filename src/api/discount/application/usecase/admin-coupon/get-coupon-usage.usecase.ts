import {
    CouponNotFoundError, CouponUsage, ICouponRedemptionRepository, ICouponRepository,
} from '@api/discount/domain'

import { IGetCouponUsage } from '../../interfaces'

export default class GetCouponUsageUseCase implements IGetCouponUsage {
    constructor(
        private readonly coupons: ICouponRepository,
        private readonly redemptions: ICouponRedemptionRepository,
    ) {}

    async execute(id: string): Promise<CouponUsage> {
        if (!(await this.coupons.findById(id))) throw new CouponNotFoundError({ id })
        return this.redemptions.usage(id)
    }
}