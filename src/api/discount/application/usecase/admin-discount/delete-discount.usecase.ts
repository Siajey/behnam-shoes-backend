import { DiscountNotFoundError, IDiscountRepository } from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { IDeleteDiscount } from '../../interfaces'

export default class DeleteDiscountUseCase implements IDeleteDiscount {
    constructor(
        private readonly discounts: IDiscountRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(id: string, actorId: string): Promise<void> {
        if (!(await this.discounts.findById(id))) throw new DiscountNotFoundError({ id })
        await this.discounts.delete(id)

        void this.logger.info('Discount deleted', {
            module: 'DeleteDiscountUseCase',
            operation: 'execute',
            event: 'discount.delete',
            userId: actorId,
            resourceId: id,
        })
    }
}