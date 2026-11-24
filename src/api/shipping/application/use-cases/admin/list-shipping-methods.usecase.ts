import { IShippingMethodRepository, ShippingMethod } from '@api/shipping/domain'

import { IListShippingMethods } from '../../interfaces/admin'

export default class ListShippingMethodsUseCase implements IListShippingMethods {
  constructor(private readonly methods: IShippingMethodRepository) {}

  execute(): Promise<ShippingMethod[]> {
    return this.methods.findAll()
  }
}
