import {
    Cart,
    CartVariantUnavailableError,
    CartView,
    ICartRepository,
    unavailableReasonOf,
} from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { AddCartItemCommand, IAddCartItem } from '../../interface/user'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class AddCartItemUseCase implements IAddCartItem {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(command: AddCartItemCommand, userId: string): Promise<CartView> {
        return withCartRetry(async () => {
            const cart = (await this.carts.findByUserId(userId)) ?? Cart.createFor(userId)

            const variant = (await this.catalog.findByIds([command.variantId]))[0] ?? null
            const reason = unavailableReasonOf(variant, 1)
            if (!variant || reason !== null) {
                throw new CartVariantUnavailableError(command.variantId, reason ?? 'variantUnavailable')
            }

            const existing = cart.quantityOf(command.variantId)
            const target = Math.min(existing + command.quantity, variant.stock)
            if (target > existing) {
                cart.addItem(command.variantId, target - existing)
                await this.carts.save(cart)
            }

            return buildCartView(this.catalog, this.pricing, cart)
        })
    }
}