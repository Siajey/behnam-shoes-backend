import { CouponLimitReachedError, ICouponRedemptionRepository } from '@api/discount/domain'

import { IReserveCoupon, ReserveCouponCommand } from '../../interfaces'

export default class ReserveCouponUseCase implements IReserveCoupon {
    constructor(private readonly redemptions: ICouponRedemptionRepository) {}

    async execute(command: ReserveCouponCommand): Promise<void> {
        const outcome = await this.redemptions.reserveIfAllowed(command)
        if (outcome !== 'reserved') throw new CouponLimitReachedError(outcome)
    }
}