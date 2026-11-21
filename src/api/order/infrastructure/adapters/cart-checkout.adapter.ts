import {Inject, Injectable} from '@nestjs/common'
import {IClearCartAfterOrder, IGetCheckoutCart} from '@api/cart/application'
import {CLEAR_CART_AFTER_ORDER, GET_CHECKOUT_CART} from '@common/di'

import {CheckoutSnapshot, ICartGateway} from '../../application'

@Injectable()
export class CartCheckoutGateway implements ICartGateway {
    constructor(
        @Inject(GET_CHECKOUT_CART) private readonly checkoutCart: IGetCheckoutCart,
        @Inject(CLEAR_CART_AFTER_ORDER) private readonly cartCleaner: IClearCartAfterOrder,
    ) {
    }

    async getCheckout(userId: string): Promise<CheckoutSnapshot> {
        const cart = await this.checkoutCart.execute(userId)
        return {
            couponCode: cart.couponCode,
            lines: cart.lines.map((l) => ({
                variantId: l.variantId,
                productId: l.productId,
                categoryId: l.category,
                brandId: l.brand,
                productName: l.productName,
                productSlug: l.productSlug,
                imageKey: l.imageKey,
                attributes: l.attributes,
                quantity: l.quantity,
                unitPrice: l.originalUnitPrice,
            })),
        }
    }

    clear(userId: string): Promise<void> {
        return this.cartCleaner.execute(userId)
    }
}