import { Cart, CartView, ICartRepository } from '@api/cart/domain'

import { buildCartView } from '../../helpers'
import { IPricingService, IVariantCatalog } from '../../ports'
import { IGetCart } from '../../interface/user'

export default class GetCartUseCase implements IGetCart {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    async execute(userId: string): Promise<CartView> {
        const cart = (await this.carts.findByUserId(userId)) ?? Cart.createFor(userId)
        return buildCartView(this.catalog, this.pricing, cart)
    }
}