import { Discount, DiscountNotFoundError, IDiscountRepository } from '@api/discount/domain'

import { IGetDiscount } from '../../interfaces'

export default class GetDiscountUseCase implements IGetDiscount {
    constructor(private readonly discounts: IDiscountRepository) {}

    async execute(id: string): Promise<Discount> {
        const discount = await this.discounts.findById(id)
        if (!discount) throw new DiscountNotFoundError({ id })
        return discount
    }
}