import {
    CartItemNotFoundError,
    CartVariantUnavailableError,
    CartView,
    ICartRepository,
    unavailableReasonOf,
} from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { ISetCartItemQuantity, SetCartItemQuantityCommand } from '../../interface'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class SetCartItemQuantityUseCase implements ISetCartItemQuantity {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(command: SetCartItemQuantityCommand, userId: string): Promise<CartView> {
        return withCartRetry(async () => {
            const cart = await this.carts.findByUserId(userId)
            if (!cart || cart.quantityOf(command.variantId) === 0) {
                throw new CartItemNotFoundError(command.variantId)
            }

            const variant = (await this.catalog.findByIds([command.variantId]))[0] ?? null
            const reason = unavailableReasonOf(variant, 1)
            if (!variant || reason !== null) {
                throw new CartVariantUnavailableError(command.variantId, reason ?? 'variantUnavailable')
            }

            cart.setQuantity(command.variantId, Math.min(command.quantity, variant.stock))
            await this.carts.save(cart)

            return buildCartView(this.catalog, this.pricing, cart)
        })
    }
}