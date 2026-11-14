import { Coupon, CouponNotFoundError, ICouponRepository } from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { EditCouponCommand, IEditCoupon } from '../../interfaces'

export default class EditCouponUseCase implements IEditCoupon {
    constructor(
        private readonly coupons: ICouponRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: EditCouponCommand, actorId: string): Promise<Coupon> {
        const coupon = await this.coupons.findById(command.id)
        if (!coupon) throw new CouponNotFoundError({ id: command.id })

        const { id: _id, ...changes } = command
        coupon.update(changes)
        await this.coupons.save(coupon)

        void this.logger.info('Coupon updated', {
            module: 'EditCouponUseCase',
            operation: 'execute',
            event: 'coupon.update',
            userId: actorId,
            resourceId: coupon.id,
        })
        return coupon
    }
}