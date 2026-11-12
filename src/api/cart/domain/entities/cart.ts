import { randomUUID } from 'node:crypto'

import {
    CartItemNotFoundError,
    CartLineLimitReachedError,
    CartQuantityLimitExceededError,
    InvalidCartQuantityError,
} from '../errors'

export const MAX_CART_LINES = 50
export const MAX_QUANTITY_PER_LINE = 10

export interface CartItem {
    variantId: string
    quantity: number
    addedAt: Date
}

export interface CartProps {
    id: string
    userId: string
    items: CartItem[]
    couponCode: string | null
    version: number
    createdAt: Date
    updatedAt: Date
}

export class Cart {
    private constructor(private props: CartProps) {}

    static createFor(userId: string): Cart {
        const now = new Date()
        return new Cart({
            id: randomUUID(),
            userId,
            items: [],
            couponCode: null,
            version: 0,
            createdAt: now,
            updatedAt: now,
        })
    }

    static restore(props: CartProps): Cart {
        return new Cart(props)
    }

    get id() { return this.props.id }
    get userId() { return this.props.userId }
    get items(): readonly CartItem[] { return this.props.items }
    get couponCode() { return this.props.couponCode }
    get version() { return this.props.version }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    get itemCount(): number {
        return this.props.items.reduce((sum, item) => sum + item.quantity, 0)
    }

    quantityOf(variantId: string): number {
        return this.find(variantId)?.quantity ?? 0
    }

    addItem(variantId: string, quantity: number): void {
        Cart.assertQuantity(quantity)
        const existing = this.find(variantId)

        if (existing) {
            const next = existing.quantity + quantity
            Cart.assertWithinLineLimit(next)
            existing.quantity = next
        } else {
            if (this.props.items.length >= MAX_CART_LINES) throw new CartLineLimitReachedError(MAX_CART_LINES)
            Cart.assertWithinLineLimit(quantity)
            this.props.items.push({ variantId, quantity, addedAt: new Date() })
        }
        this.touch()
    }

    addItemCapped(variantId: string, quantity: number): number {
        Cart.assertQuantity(quantity)
        const existing = this.find(variantId)

        if (existing) {
            const added = Math.min(quantity, MAX_QUANTITY_PER_LINE - existing.quantity)
            if (added <= 0) return 0
            existing.quantity += added
            this.touch()
            return added
        }

        if (this.props.items.length >= MAX_CART_LINES) return 0
        const added = Math.min(quantity, MAX_QUANTITY_PER_LINE)
        this.props.items.push({ variantId, quantity: added, addedAt: new Date() })
        this.touch()
        return added
    }

    setQuantity(variantId: string, quantity: number): void {
        Cart.assertQuantity(quantity)
        Cart.assertWithinLineLimit(quantity)
        const item = this.find(variantId)
        if (!item) throw new CartItemNotFoundError(variantId)
        item.quantity = quantity
        this.touch()
    }

    removeItem(variantId: string): void {
        if (!this.find(variantId)) throw new CartItemNotFoundError(variantId)
        this.props.items = this.props.items.filter((i) => i.variantId !== variantId)
        this.touch()
    }

    clear(): void {
        this.props.items = []
        this.props.couponCode = null
        this.touch()
    }

    applyCoupon(code: string): void {
        this.props.couponCode = code
        this.touch()
    }

    removeCoupon(): void {
        this.props.couponCode = null
        this.touch()
    }

    private find(variantId: string): CartItem | undefined {
        return this.props.items.find((i) => i.variantId === variantId)
    }

    private static assertQuantity(quantity: number): void {
        if (!Number.isInteger(quantity) || quantity < 1) throw new InvalidCartQuantityError()
    }

    private static assertWithinLineLimit(quantity: number): void {
        if (quantity > MAX_QUANTITY_PER_LINE) {
            throw new CartQuantityLimitExceededError(MAX_QUANTITY_PER_LINE)
        }
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}