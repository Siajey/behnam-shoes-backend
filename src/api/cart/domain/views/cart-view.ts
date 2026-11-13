import { CartItem } from '../entities'
import { CartCheckoutBlockedError } from '../errors'
import { CouponStatus, PricingResult, PurchasableVariant } from '../value-objects'

export type UnavailableReason =
    | 'variantUnavailable'
    | 'productUnavailable'
    | 'outOfStock'
    | 'insufficientStock'

export function unavailableReasonOf(
    variant: PurchasableVariant | null,
    quantity: number,
): UnavailableReason | null {
    if (!variant || !variant.isActive) return 'variantUnavailable'
    if (!variant.isProductPublished) return 'productUnavailable'
    if (variant.stock <= 0) return 'outOfStock'
    if (quantity > variant.stock) return 'insufficientStock'
    return null
}

export interface EvaluatedLine {
    variantId: string
    quantity: number
    variant: PurchasableVariant | null
    unavailableReason: UnavailableReason | null
}

export function evaluateCartLines(
    items: readonly CartItem[],
    variants: ReadonlyMap<string, PurchasableVariant>,
): EvaluatedLine[] {
    return items.map((item) => {
        const variant = variants.get(item.variantId) ?? null
        return {
            variantId: item.variantId,
            quantity: item.quantity,
            variant,
            unavailableReason: unavailableReasonOf(variant, item.quantity),
        }
    })
}

export interface CartViewLine extends EvaluatedLine {
    pricing: {
        originalUnitPrice: number
        unitPrice: number
        lineTotal: number
        couponAllocation: number
    } | null
}

export class CartView {
    private constructor(
        readonly lines: readonly CartViewLine[],
        readonly coupon: { code: string | null; status: CouponStatus },
        readonly couponDiscount: number,
    ) {}

    static build(evaluated: readonly EvaluatedLine[], pricing: PricingResult): CartView {
        const priced = new Map(pricing.lines.map((l) => [l.variantId, l]))

        const lines = evaluated.map((line): CartViewLine => {
            const p = line.unavailableReason === null ? priced.get(line.variantId) : undefined
            return {
                ...line,
                pricing: p
                    ? {
                        originalUnitPrice: p.originalUnitPrice,
                        unitPrice: p.unitPrice,
                        lineTotal: p.unitPrice * line.quantity,
                        couponAllocation: p.couponAllocation,
                    }
                    : null,
            }
        })

        return new CartView(lines, { code: pricing.couponCode, status: pricing.couponStatus }, pricing.couponDiscount)
    }

    get itemCount(): number {
        return this.lines.reduce((sum, l) => sum + l.quantity, 0)
    }

    get subtotal(): number {
        return this.lines.reduce((sum, l) => sum + (l.pricing ? l.pricing.originalUnitPrice * l.quantity : 0), 0)
    }

    get productDiscountTotal(): number {
        return this.lines.reduce(
            (sum, l) => sum + (l.pricing ? (l.pricing.originalUnitPrice - l.pricing.unitPrice) * l.quantity : 0),
            0,
        )
    }

    get total(): number {
        return Math.max(0, this.subtotal - this.productDiscountTotal - this.couponDiscount)
    }

    get hasUnavailableLines(): boolean {
        return this.lines.some((l) => l.unavailableReason !== null)
    }

    assertCheckoutable(): void {
        if (this.lines.length === 0) throw new CartCheckoutBlockedError([{ variantId: null, reason: 'empty' }])

        const problems = this.lines
            .filter((l) => l.unavailableReason !== null)
            .map((l) => ({ variantId: l.variantId, reason: l.unavailableReason as string }))
        if (problems.length > 0) throw new CartCheckoutBlockedError(problems)
    }
}