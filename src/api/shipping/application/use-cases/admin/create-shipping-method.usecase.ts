import {
  IShippingMethodRepository, ShippingCarrierNotSupportedError, ShippingMethod,
  ShippingMethodCodeAlreadyExistsError,
} from '@api/shipping/domain'
import { ILogger } from '@common/logger'

import { CreateShippingMethodCommand, ICreateShippingMethod } from '../../interfaces/admin'
import { IShippingCarrierRegistry } from '../../ports'

export default class CreateShippingMethodUseCase implements ICreateShippingMethod {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly carriers: IShippingCarrierRegistry,
    private readonly logger: ILogger,
  ) {}

  async execute(command: CreateShippingMethodCommand, actorId: string): Promise<ShippingMethod> {
    const method = ShippingMethod.create(command)

    if (!this.carriers.has(method.carrier)) throw new ShippingCarrierNotSupportedError(method.carrier)
    if (await this.methods.codeExists(method.code)) throw new ShippingMethodCodeAlreadyExistsError(method.code)

    await this.methods.save(method)

    void this.logger.info('Shipping method created', {
      module: 'CreateShippingMethodUseCase',
      operation: 'execute',
      event: 'shipping.method.create',
      userId: actorId,
      resourceId: method.id,
    })
    return method
  }
}
