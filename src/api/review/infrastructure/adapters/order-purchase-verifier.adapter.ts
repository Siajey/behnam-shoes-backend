import { Inject, Injectable } from '@nestjs/common'

import { IHasPurchasedProduct } from '@api/order/application'
import { HAS_PURCHASED_PRODUCT } from '@common/di'
import { IPurchaseVerifier } from '@api/review/application'

@Injectable()
export class OrderPurchaseVerifier implements IPurchaseVerifier {
  constructor(@Inject(HAS_PURCHASED_PRODUCT) private readonly hasPurchasedProduct: IHasPurchasedProduct) {}

  hasPurchased(userId: string, productId: string): Promise<boolean> {
    return this.hasPurchasedProduct.execute(userId, productId)
  }
}
