import {randomUUID} from 'node:crypto'

import {InvalidPaymentStatusTransitionError} from '../errors'

export const PAYMENT_STATUSES = ['initiated', 'redirected', 'paid', 'failed', 'expired'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    initiated: ['redirected', 'failed'], redirected: ['paid', 'failed', 'expired'],
    paid: [], failed: [], expired: [],
}

export interface PaymentProps {
    id: string;
    orderId: string;
    userId: string;
    gateway: string;
    amount: number;
    currency: string
    status: PaymentStatus;
    reference: string | null;
    trackingCode: string | null;
    cardMask: string | null
    failureReason: string | null;
    paidAt: Date | null;
    orderConfirmedAt: Date | null;
    version: number
    createdAt: Date;
    updatedAt: Date
}

export interface StartPaymentInput {
    orderId: string;
    userId: string;
    gateway: string;
    amount: number;
    currency: string
}

export interface PaidDetails {
    trackingCode: string | null;
    cardMask: string | null;
    paidAt: Date | null
}

export class Payment {
    private constructor(private props: PaymentProps) {
    }

    get id() {
        return this.props.id
    }

    get orderId() {
        return this.props.orderId
    }

    get userId() {
        return this.props.userId
    }

    get gateway() {
        return this.props.gateway
    }

    get amount() {
        return this.props.amount
    }

    get currency() {
        return this.props.currency
    }

    get status() {
        return this.props.status
    }

    get reference() {
        return this.props.reference
    }

    get trackingCode() {
        return this.props.trackingCode
    }

    get cardMask() {
        return this.props.cardMask
    }

    get failureReason() {
        return this.props.failureReason
    }

    get paidAt() {
        return this.props.paidAt
    }

    get orderConfirmedAt() {
        return this.props.orderConfirmedAt
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

    get needsOrderConfirmation() {
        return this.props.status === 'paid' && this.props.orderConfirmedAt === null
    }

    static start(input: StartPaymentInput): Payment {
        const now = new Date()
        if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new RangeError('Payment amount must be a positive integer in Toman')
        return new Payment({
            ...input,
            id: randomUUID(),
            status: 'initiated',
            reference: null,
            trackingCode: null,
            cardMask: null,
            failureReason: null,
            paidAt: null,
            orderConfirmedAt: null,
            version: 0,
            createdAt: now,
            updatedAt: now
        })
    }

    static restore(props: PaymentProps): Payment {
        return new Payment(props)
    }

    markRedirected(reference: string): void {
        this.transition('redirected');
        this.props.reference = reference
    }

    markPaid(details: PaidDetails): void {
        this.transition('paid');
        this.props.trackingCode = details.trackingCode;
        this.props.cardMask = details.cardMask
        this.props.paidAt = details.paidAt ?? this.props.updatedAt
    }

    markFailed(reason: string): void {
        this.transition('failed');
        this.props.failureReason = reason
    }

    markExpired(): void {
        this.transition('expired')
    }

    markOrderConfirmed(): void {
        if (this.props.status !== 'paid') throw new InvalidPaymentStatusTransitionError(this.props.status, 'order_confirmed')
        this.props.orderConfirmedAt = new Date();
        this.props.updatedAt = this.props.orderConfirmedAt
    }

    private transition(to: PaymentStatus): void {
        if (!ALLOWED_TRANSITIONS[this.props.status].includes(to)) throw new InvalidPaymentStatusTransitionError(this.props.status, to)
        this.props.status = to;
        this.props.updatedAt = new Date()
    }
}
