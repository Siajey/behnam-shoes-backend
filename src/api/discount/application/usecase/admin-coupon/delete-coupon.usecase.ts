import {
    CouponHasRedemptionsError, CouponNotFoundError, ICouponRedemptionRepository, ICouponRepository,
} from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { IDeleteCoupon } from '../../interfaces'

export default class DeleteCouponUseCase implements IDeleteCoupon {
    constructor(
        private readonly coupons: ICouponRepository,
        private readonly redemptions: ICouponRedemptionRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(id: string, actorId: string): Promise<void> {
        if (!(await this.coupons.findById(id))) throw new CouponNotFoundError({ id })
        if (await this.redemptions.hasAny(id)) throw new CouponHasRedemptionsError()

        await this.coupons.delete(id)

        void this.logger.info('Coupon deleted', {
            module: 'DeleteCouponUseCase',
            operation: 'execute',
            event: 'coupon.delete',
            userId: actorId,
            resourceId: id,
        })
    }
}