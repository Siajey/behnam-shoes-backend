import { CouponListCriteria, CouponPage, ICouponRepository } from '@api/discount/domain'

import { IListCoupons } from '../../interfaces'

export default class ListCouponsUseCase implements IListCoupons {
    constructor(private readonly coupons: ICouponRepository) {}

    execute(query: CouponListCriteria): Promise<CouponPage> {
        return this.coupons.findAll(query)
    }
}