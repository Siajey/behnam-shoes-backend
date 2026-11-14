import { Coupon, CouponCodeAlreadyExistsError, ICouponRepository } from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { CreateCouponCommand, ICreateCoupon } from '../../interfaces'

export default class CreateCouponUseCase implements ICreateCoupon {
    constructor(
        private readonly coupons: ICouponRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: CreateCouponCommand, actorId: string): Promise<Coupon> {
        const coupon = Coupon.create(command)
        if (await this.coupons.codeExists(coupon.code)) throw new CouponCodeAlreadyExistsError(coupon.code)

        await this.coupons.save(coupon)

        void this.logger.info('Coupon created', {
            module: 'CreateCouponUseCase',
            operation: 'execute',
            event: 'coupon.create',
            userId: actorId,
            resourceId: coupon.id,
        })
        return coupon
    }
}