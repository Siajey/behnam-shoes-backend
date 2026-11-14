import { Discount, DiscountNotFoundError, IDiscountRepository } from '@api/discount/domain'
import { ILogger } from '@common/logger'

import { EditDiscountCommand, IEditDiscount } from '../../interfaces'

export default class EditDiscountUseCase implements IEditDiscount {
    constructor(
        private readonly discounts: IDiscountRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: EditDiscountCommand, actorId: string): Promise<Discount> {
        const discount = await this.discounts.findById(command.id)
        if (!discount) throw new DiscountNotFoundError({ id: command.id })

        const { id: _id, ...changes } = command
        discount.update(changes)
        await this.discounts.save(discount)

        void this.logger.info('Discount updated', {
            module: 'EditDiscountUseCase',
            operation: 'execute',
            event: 'discount.update',
            userId: actorId,
            resourceId: discount.id,
        })
        return discount
    }
}