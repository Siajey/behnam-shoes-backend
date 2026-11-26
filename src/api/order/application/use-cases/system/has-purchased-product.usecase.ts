import { IOrderRepository } from '@api/order/domain'

import { IHasPurchasedProduct } from '../../interfaces'

export default class HasPurchasedProductUseCase implements IHasPurchasedProduct {
  constructor(private readonly orders: IOrderRepository) {}

  execute(userId: string, productId: string): Promise<boolean> {
    return this.orders.hasPurchasedProduct(userId, productId)
  }
}
