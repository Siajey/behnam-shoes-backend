import {
  IShippingMethodRepository, ShippingMethod, ShippingMethodNotFoundError,
} from '@api/shipping/domain'

import { IGetShippingMethod } from '../../interfaces/admin'

export default class GetShippingMethodUseCase implements IGetShippingMethod {
  constructor(private readonly methods: IShippingMethodRepository) {}

  async execute(id: string): Promise<ShippingMethod> {
    const method = await this.methods.findById(id)
    if (!method) throw new ShippingMethodNotFoundError({ id })
    return method
  }
}
