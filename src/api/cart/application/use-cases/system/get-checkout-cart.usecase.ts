import { Cart, ICartRepository } from '@api/cart/domain'

import { buildCartView } from '../../helpers'
import { CheckoutCart, IGetCheckoutCart } from '../../interface'
import { IPricingService, IVariantCatalog } from '../../ports'

export default class GetCheckoutCartUseCase implements IGetCheckoutCart {
    constructor(
        private readonly carts: ICartRepository,
        private readonly catalog: IVariantCatalog,
        private readonly pricing: IPricingService,
    ) {}

    async execute(userId: string): Promise<CheckoutCart> {
        const cart = (await this.carts.findByUserId(userId)) ?? Cart.createFor(userId)
        const view = await buildCartView(this.catalog, this.pricing, cart)

        view.assertCheckoutable()

        return {
            lines: view.lines.flatMap((line) => {
                const { variant, pricing } = line
                if (!variant || !pricing || variant.productId === null) return []
                return [
                    {
                        variantId: line.variantId,
                        productId: variant.productId,
                        productName: variant.productName ?? '',
                        productSlug: variant.productSlug ?? '',
                        imageKey: variant.imageKey,
                        attributes: variant.attributes,
                        quantity: line.quantity,
                        originalUnitPrice: pricing.originalUnitPrice,
                        unitPrice: pricing.unitPrice,
                        couponAllocation: pricing.couponAllocation,
                    },
                ]
            }),
            couponCode: view.coupon.code,
            couponStatus: view.coupon.status,
            subtotal: view.subtotal,
            productDiscountTotal: view.productDiscountTotal,
            couponDiscount: view.couponDiscount,
            total: view.total,
        }
    }
}