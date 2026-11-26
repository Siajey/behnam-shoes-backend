import { IShippingMethodRepository, ShippingMethodNotFoundError } from '@api/shipping/domain'
import { ILogger } from '@common/logger'

import { IDeleteShippingMethod } from '../../interfaces/admin'

export default class DeleteShippingMethodUseCase implements IDeleteShippingMethod {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    if (!(await this.methods.findById(id))) throw new ShippingMethodNotFoundError({ id })
    await this.methods.delete(id)

    void this.logger.info('Shipping method deleted', {
      module: 'DeleteShippingMethodUseCase',
      operation: 'execute',
      event: 'shipping.method.delete',
      userId: actorId,
      resourceId: id,
    })
  }
}
