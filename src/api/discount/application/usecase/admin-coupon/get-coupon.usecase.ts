import { Coupon, CouponNotFoundError, ICouponRepository } from '@api/discount/domain'

import { IGetCoupon } from '../../interfaces'

export default class GetCouponUseCase implements IGetCoupon {
    constructor(private readonly coupons: ICouponRepository) {}

    async execute(id: string): Promise<Coupon> {
        const coupon = await this.coupons.findById(id)
        if (!coupon) throw new CouponNotFoundError({ id })
        return coupon
    }
}