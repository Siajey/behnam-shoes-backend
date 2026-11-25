import {randomUUID} from 'node:crypto'

import {EmptyOrderError, InvalidOrderStatusTransitionError} from '../errors'

export const ORDER_STATUSES = [
    'pending_payment',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'expired',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending_payment: ['paid', 'cancelled', 'expired'],
    expired: ['paid'],
    paid: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
}

export const PAYMENT_WINDOW_MINUTES = 30

export interface OrderLine {
    variantId: string
    productId: string
    productName: string
    productSlug: string
    imageKey: string | null
    sku: string
    externalSource: string
    externalId: string
    attributes: { name: string; value: string }[]
    quantity: number
    originalUnitPrice: number
    unitPrice: number
    couponAllocation: number
}
export interface ShippingMethodSnapshot {
    code: string
    name: string
}

export interface ShippingAddress {
    province: string
    city: string
    street: string
    postalCode: string
}

export interface Recipient {
    firstName: string
    lastName: string
    phoneNumber: string
}

export interface OrderCoupon {
    couponId: string
    code: string
}

export interface Shipment {
    carrier: string | null
    trackingCode: string | null
}

export interface OrderStatusEvent {
    id: string
    status: OrderStatus
    note: string | null
    actorId: string | null
    createdAt: Date
}

export interface OrderProps {
    id: string
    orderNumber: number | null
    userId: string
    status: OrderStatus
    lines: OrderLine[]
    coupon: OrderCoupon | null
    shippingFee: number
    shippingMethod: ShippingMethodSnapshot
    currency: string
    shippingAddress: ShippingAddress
    recipient: Recipient
    shipment: Shipment
    idempotencyKey: string
    expiresAt: Date
    paidAt: Date | null
    events: OrderStatusEvent[]
    version: number
    createdAt: Date
    updatedAt: Date
}

export interface PlaceOrderInput {
    userId: string
    idempotencyKey: string
    lines: OrderLine[]
    coupon: OrderCoupon | null
    shippingFee: number
    shippingMethod: ShippingMethodSnapshot
    currency: string
    shippingAddress: ShippingAddress
    recipient: Recipient
}

export const orderLineTotal = (line: OrderLine): number =>
    line.unitPrice * line.quantity - line.couponAllocation

export class Order {
    private constructor(private props: OrderProps) {
    }

    static place(input: PlaceOrderInput): Order {
        if (input.lines.length === 0) throw new EmptyOrderError()

        const now = new Date()
        return new Order({
            id: randomUUID(),
            orderNumber: null,
            userId: input.userId,
            status: 'pending_payment',
            lines: input.lines,
            coupon: input.coupon,
            shippingFee: input.shippingFee,
            shippingMethod: input.shippingMethod,
            currency: input.currency,
            shippingAddress: input.shippingAddress,
            recipient: input.recipient,
            shipment: {carrier: null, trackingCode: null},
            idempotencyKey: input.idempotencyKey,
            expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000),
            paidAt: null,
            events: [Order.event('pending_payment', null, null, now)],
            version: 0,
            createdAt: now,
            updatedAt: now,
        })
    }

    static restore(props: OrderProps): Order {
        return new Order(props)
    }

    private static event(
        status: OrderStatus,
        actorId: string | null,
        note: string | null,
        createdAt: Date,
    ): OrderStatusEvent {
        return {id: randomUUID(), status, note, actorId, createdAt}
    }

    get id() {
        return this.props.id
    }

    get orderNumber() {
        return this.props.orderNumber
    }

    get userId() {
        return this.props.userId
    }

    get status() {
        return this.props.status
    }

    get lines(): readonly OrderLine[] {
        return this.props.lines
    }

    get coupon() {
        return this.props.coupon
    }

    get shippingFee() {
        return this.props.shippingFee
    }

    get currency() {
        return this.props.currency
    }

    get shippingAddress() {
        return this.props.shippingAddress
    }

    get recipient() {
        return this.props.recipient
    }

    get shipment() {
        return this.props.shipment
    }

    get idempotencyKey() {
        return this.props.idempotencyKey
    }

    get expiresAt() {
        return this.props.expiresAt
    }

    get paidAt() {
        return this.props.paidAt
    }

    get events(): readonly OrderStatusEvent[] {
        return this.props.events
    }

    get version() {
        return this.props.version
    }

    get createdAt() {
        return this.props.createdAt
    }

    get updatedAt() {
        return this.props.updatedAt
    }


    get itemCount(): number {
        return this.props.lines.reduce((sum, l) => sum + l.quantity, 0)
    }

    get subtotal(): number {
        return this.props.lines.reduce((sum, l) => sum + l.originalUnitPrice * l.quantity, 0)
    }

    get productDiscountTotal(): number {
        return this.props.lines.reduce((sum, l) => sum + (l.originalUnitPrice - l.unitPrice) * l.quantity, 0)
    }

    get couponDiscount(): number {
        return this.props.lines.reduce((sum, l) => sum + l.couponAllocation, 0)
    }

    get total(): number {
        return this.subtotal - this.productDiscountTotal - this.couponDiscount + this.props.shippingFee
    }

    get hasBeenPaid(): boolean {
        return this.props.paidAt !== null
    }
    get shippingMethod() { return this.props.shippingMethod }

    canPay(now: Date): boolean {
        return this.props.status === 'pending_payment' && now < this.props.expiresAt
    }

    isExpirable(now: Date): boolean {
        return this.props.status === 'pending_payment' && now >= this.props.expiresAt
    }

    assignNumber(orderNumber: number): void {
        this.props.orderNumber = orderNumber
    }

    markPaid(): void {
        this.transition('paid', null, null)
        this.props.paidAt = this.props.updatedAt
    }

    expire(): void {
        this.transition('expired', null, null)
    }

    startProcessing(actorId: string, note: string | null = null): void {
        this.transition('processing', actorId, note)
    }

    ship(actorId: string, shipment: Partial<Shipment>, note: string | null = null): void {
        this.transition('shipped', actorId, note)
        this.props.shipment = {
            carrier: shipment.carrier ?? null,
            trackingCode: shipment.trackingCode ?? null,
        }
    }

    deliver(actorId: string | null, note: string | null = null): void {
        this.transition('delivered', actorId, note)
    }

    cancel(actorId: string, note: string | null = null): void {
        this.transition('cancelled', actorId, note)
    }

    private transition(to: OrderStatus, actorId: string | null, note: string | null): void {
        if (!ALLOWED_ORDER_TRANSITIONS[this.props.status].includes(to)) {
            throw new InvalidOrderStatusTransitionError(this.props.status, to)
        }
        const now = new Date()
        this.props.status = to
        this.props.events.push(Order.event(to, actorId, note, now))
        this.props.updatedAt = now
    }


    updateShipment(shipment: { carrier: string | null; trackingCode: string | null }): void {
        if (this.props.status !== 'shipped') {
            throw new InvalidOrderStatusTransitionError(this.props.status, 'shipped')
        }
        this.props.shipment = shipment
        this.props.updatedAt = new Date()
    }
}
