import { Inject, Injectable } from '@nestjs/common'

import { IGetCheckoutCart } from '@api/cart/application'
import { GET_CHECKOUT_CART } from '@common/di'
import { CheckoutParcels, ICheckoutParcels } from '@api/shipping/application/ports'

@Injectable()
export class CartCheckoutParcels implements ICheckoutParcels {
  constructor(@Inject(GET_CHECKOUT_CART) private readonly checkoutCart: IGetCheckoutCart) {}

  async get(userId: string): Promise<CheckoutParcels> {
    const cart = await this.checkoutCart.execute(userId)
    return {
      lines: cart.lines.map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      subtotalAfterDiscounts: cart.total,
    }
  }
}
