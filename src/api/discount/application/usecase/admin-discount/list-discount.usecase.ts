import { DiscountListCriteria, DiscountPage, IDiscountRepository } from '@api/discount/domain'

import { IListDiscounts } from '../../interfaces'

export default class ListDiscountsUseCase implements IListDiscounts {
    constructor(private readonly discounts: IDiscountRepository) {}

    execute(query: DiscountListCriteria): Promise<DiscountPage> {
        return this.discounts.findAll(query)
    }
}