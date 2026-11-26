import {
  IShippingMethodRepository, ShippingCarrierNotSupportedError, ShippingMethod,
  ShippingMethodNotFoundError,
} from '@api/shipping/domain'
import { ILogger } from '@common/logger'

import { EditShippingMethodCommand, IEditShippingMethod } from '../../interfaces/admin'
import { IShippingCarrierRegistry } from '../../ports'

export default class EditShippingMethodUseCase implements IEditShippingMethod {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly carriers: IShippingCarrierRegistry,
    private readonly logger: ILogger,
  ) {}

  async execute(command: EditShippingMethodCommand, actorId: string): Promise<ShippingMethod> {
    const method = await this.methods.findById(command.id)
    if (!method) throw new ShippingMethodNotFoundError({ id: command.id })

    const { id: _id, ...changes } = command
    method.update(changes)
    if (!this.carriers.has(method.carrier)) throw new ShippingCarrierNotSupportedError(method.carrier)

    await this.methods.save(method)

    void this.logger.info('Shipping method updated', {
      module: 'EditShippingMethodUseCase',
      operation: 'execute',
      event: 'shipping.method.update',
      userId: actorId,
      resourceId: method.id,
    })
    return method
  }
}
