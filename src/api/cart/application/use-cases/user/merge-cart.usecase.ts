import { Cart, ICartRepository, unavailableReasonOf } from '@api/cart/domain'

import { buildCartView, withCartRetry } from '../../helpers'
import { IMergeCart, MergeCartCommand, MergeCartResult } from '../../interface/user'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class MergeCartUseCase implements IMergeCart {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    execute(command: MergeCartCommand, userId: string): Promise<MergeCartResult> {
        return withCartRetry(async () => {
            const cart = (await this.carts.findByUserId(userId)) ?? Cart.createFor(userId)

            const wanted = new Map<string, number>()
            for (const item of command.items) {
                wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity)
            }

            const variants = new Map(
                (await this.catalog.findByIds([...wanted.keys()])).map((v) => [v.id, v]),
            )

            const skippedVariantIds: string[] = []
            let changed = false

            for (const [variantId, quantity] of wanted) {
                const variant = variants.get(variantId) ?? null
                if (!variant || unavailableReasonOf(variant, 1) !== null) {
                    skippedVariantIds.push(variantId)
                    continue
                }

                const room = variant.stock - cart.quantityOf(variantId)
                const allowed = Math.min(quantity, room)
                if (allowed <= 0) continue

                if (cart.addItemCapped(variantId, allowed) > 0) changed = true
                else skippedVariantIds.push(variantId)
            }

            if (changed) await this.carts.save(cart)

            return { cart: await buildCartView(this.catalog, this.pricing, cart), skippedVariantIds }
        })
    }
}