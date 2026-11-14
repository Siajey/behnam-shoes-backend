import { Cart, CartView, ICartRepository } from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { IRemoveCartCoupon } from '../../interface'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class RemoveCartCouponUseCase implements IRemoveCartCoupon {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(userId: string): Promise<CartView> {
        return withCartRetry(async () => {
            const cart = await this.carts.findByUserId(userId)
            if (!cart) return buildCartView(this.catalog, this.pricing, Cart.createFor(userId))

            if (cart.couponCode !== null) {
                cart.removeCoupon()
                await this.carts.save(cart)
            }
            return buildCartView(this.catalog, this.pricing, cart)
        })
    }
}