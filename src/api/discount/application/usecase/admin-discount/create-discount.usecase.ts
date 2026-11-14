import { Discount, IDiscountRepository } from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { CreateDiscountCommand, ICreateDiscount } from '../../interfaces'

export default class CreateDiscountUseCase implements ICreateDiscount {
    constructor(
        private readonly discounts: IDiscountRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: CreateDiscountCommand, actorId: string): Promise<Discount> {
        const discount = Discount.create(command)
        await this.discounts.save(discount)

        void this.logger.info('Discount created', {
            module: 'CreateDiscountUseCase',
            operation: 'execute',
            event: 'discount.create',
            userId: actorId,
            resourceId: discount.id,
        })
        return discount
    }
}