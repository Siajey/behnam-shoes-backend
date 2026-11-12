import { CartItemNotFoundError, CartView, ICartRepository } from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { IRemoveCartItem } from '../../interface/user'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class RemoveCartItemUseCase implements IRemoveCartItem {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(variantId: string, userId: string): Promise<CartView> {
        return withCartRetry(async () => {
            const cart = await this.carts.findByUserId(userId)
            if (!cart) throw new CartItemNotFoundError(variantId)

            cart.removeItem(variantId)
            await this.carts.save(cart)

            return buildCartView(this.catalog, this.pricing, cart)
        })
    }
}