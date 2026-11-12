import { Cart, CartView, evaluateCartLines } from '@api/cart/domain'

import { IPricingService, IVariantCatalog, PricingRequestLine } from '../ports'

export async function buildCartView(
    catalog: IVariantCatalog,
    pricing: IPricingService,
    cart: Cart,
): Promise<CartView> {
    const found = await catalog.findByIds(cart.items.map((i) => i.variantId))
    const evaluated = evaluateCartLines(cart.items, new Map(found.map((v) => [v.id, v])))

    const lines = evaluated.flatMap((line): PricingRequestLine[] => {
        const { variant } = line
        if (line.unavailableReason !== null || !variant || variant.productId === null) return []
        return [
            {
                variantId: line.variantId,
                productId: variant.productId,
                categoryId: variant.categoryId,
                brandId: variant.brandId,
                unitPrice: variant.price,
                quantity: line.quantity,
            },
        ]
    })

    const result = await pricing.price({ userId: cart.userId, lines, couponCode: cart.couponCode })
    return CartView.build(evaluated, result)
}