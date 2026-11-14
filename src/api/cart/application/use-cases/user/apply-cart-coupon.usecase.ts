import { Cart, CartCouponInvalidError, CartView, ICartRepository } from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { ApplyCartCouponCommand, IApplyCartCoupon } from '../../interface'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class ApplyCartCouponUseCase implements IApplyCartCoupon {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(command: ApplyCartCouponCommand, userId: string): Promise<CartView> {
        return withCartRetry(async () => {
            const cart = (await this.carts.findByUserId(userId)) ?? Cart.createFor(userId)

            cart.applyCoupon(command.code)
            const view = await buildCartView(this.catalog, this.pricing, cart)

            if (view.coupon.status !== 'applied' || view.coupon.code === null) {
                throw new CartCouponInvalidError(view.coupon.invalidReason ?? 'invalid')
            }

            cart.applyCoupon(view.coupon.code)
            await this.carts.save(cart)
            return view
        })
    }
}