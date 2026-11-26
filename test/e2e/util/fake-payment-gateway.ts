import {randomUUID} from 'node:crypto'

import {GatewayPaymentRequest, GatewayPaymentTarget, GatewayVerification, IPaymentGateway} from '@api/payment/application'
import {PaymentGatewayError} from '@api/payment/domain'

// the payment module reads these from config; set defaults for the e2e environment
process.env.PAYMENT_CALLBACK_BASE_URL ??= 'https://api.test'
process.env.PAYMENT_RESULT_URL ??= 'https://shop.test/payment/result'
export const CALLBACK_BASE = process.env.PAYMENT_CALLBACK_BASE_URL.replace(/\/+$/, '')
export const API_VERSION = process.env.API_VERSION ?? '1'
export const RESULT_URL = process.env.PAYMENT_RESULT_URL

const PENDING: GatewayVerification = {status: 'pending', amount: null, trackingCode: null, cardMask: null, paidAt: null, failureCode: null}

/** Replaces Zibal in the e2e app. It keeps Zibal's name, so the default gateway and callback URL stay the same. */
export class FakePaymentGateway implements IPaymentGateway {
    readonly name = 'zibal'
    currencies: string[] = ['IRT']
    requests: GatewayPaymentRequest[] = []
    verifyCalls: string[] = []
    private failRequest = false
    private verifications = new Map<string, GatewayVerification | Error>()

    async requestPayment(request: GatewayPaymentRequest): Promise<GatewayPaymentTarget> {
        if (this.failRequest) {
            this.failRequest = false
            throw new PaymentGatewayError({gateway: this.name, stage: 'request'})
        }
        this.requests.push(request)
        const reference = `trk-${randomUUID()}`
        return {reference, redirectUrl: `https://gateway.test/start/${reference}`}
    }

    parseCallback(params: Record<string, string>) {
        const reference = params.trackId?.trim()
        return reference ? {reference} : null
    }

    async verify(reference: string): Promise<GatewayVerification> {
        this.verifyCalls.push(reference)
        const result = this.verifications.get(reference) ?? PENDING
        if (result instanceof Error) throw result
        return result
    }

    /* ---- test controls ---- */
    failNextRequest() { this.failRequest = true }
    pending(reference: string) { this.verifications.set(reference, PENDING) }
    approve(reference: string, amount: number | null, extra: Partial<GatewayVerification> = {}) {
        this.verifications.set(reference, {
            status: 'paid', amount, trackingCode: `TRK-${reference.slice(-6)}`, cardMask: '603799******1234',
            paidAt: new Date(), failureCode: null, ...extra,
        })
    }
    decline(reference: string, failureCode: string | null = null) {
        this.verifications.set(reference, {...PENDING, status: 'failed', failureCode})
    }
    failVerify(reference: string) {
        this.verifications.set(reference, new PaymentGatewayError({gateway: this.name, stage: 'verify'}))
    }
    verifyCount(reference: string) { return this.verifyCalls.filter((r) => r === reference).length }
    reset() {
        this.currencies = ['IRT']
        this.requests = []
        this.verifyCalls = []
        this.failRequest = false
        this.verifications.clear()
    }
}

export const fakePaymentGateway = new FakePaymentGateway()
