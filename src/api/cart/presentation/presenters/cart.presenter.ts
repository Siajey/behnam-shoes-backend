import { CartView, CartViewLine, MAX_QUANTITY_PER_LINE } from '@api/cart/domain'

export class CartPresenter {
    static toResponse(view: CartView) {
        return {
            items: view.lines.map(CartPresenter.line),
            coupon: view.coupon,
            totals: {
                itemCount: view.itemCount,
                subtotal: view.subtotal,
                productDiscountTotal: view.productDiscountTotal,
                couponDiscount: view.couponDiscount,
                total: view.total,
            },
            hasUnavailableLines: view.hasUnavailableLines,
        }
    }

    private static line(line: CartViewLine) {
        const { variant, pricing } = line
        return {
            variantId: line.variantId,
            quantity: line.quantity,
            available: line.unavailableReason === null,
            unavailableReason: line.unavailableReason,
            maxQuantity: variant && line.unavailableReason !== 'variantUnavailable'
                ? Math.min(variant.stock, MAX_QUANTITY_PER_LINE)
                : 0,
            product: variant
                ? {
                    id: variant.productId,
                    name: variant.productName,
                    slug: variant.productSlug,
                    imageKey: variant.imageKey,
                }
                : null,
            attributes: variant?.attributes ?? [],
            originalUnitPrice: pricing?.originalUnitPrice ?? null,
            unitPrice: pricing?.unitPrice ?? null,
            lineTotal: pricing?.lineTotal ?? null,
            couponAllocation: pricing?.couponAllocation ?? null,
        }
    }
}