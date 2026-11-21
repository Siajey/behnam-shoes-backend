import {Inject, Injectable} from '@nestjs/common'

import {
    GatewayCallback,
    GatewayPaymentRequest,
    GatewayPaymentTarget,
    GatewayVerification,
    IPaymentGateway
} from '@api/payment/application'
import {PaymentGatewayError} from '@api/payment/domain'
import {ConfigProvider} from '@common/configuration'
import {CONFIG_PROVIDER} from '@common/di'

interface ZibalResponse {
    result: number;
    message?: string;
    trackId?: number;
    amount?: number;
    status?: number;
    refNumber?: number | string;
    cardNumber?: string;
    paidAt?: string
}

@Injectable()
export class ZibalGateway implements IPaymentGateway {
    readonly name = 'zibal';
    readonly currencies = ['IRT'] as const

    constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {
    }

    async requestPayment(request: GatewayPaymentRequest): Promise<GatewayPaymentTarget> {
        const body = await this.post('request', 'request', {
            merchant: this.config.get('ZIBAL_MERCHANT'), amount: request.amount * this.multiplier(),
            callbackUrl: request.callbackUrl, description: request.description, orderId: request.paymentId
        })
        if (body.result !== 100 || body.trackId === undefined) throw new PaymentGatewayError({
            gateway: this.name,
            stage: 'request',
            code: String(body.result)
        })
        return {reference: String(body.trackId), redirectUrl: `${this.baseUrl()}/start/${body.trackId}`}
    }

    parseCallback(params: Record<string, string>): GatewayCallback | null {
        const reference = params.trackId?.trim();
        return reference ? {reference} : null
    }

    async verify(reference: string): Promise<GatewayVerification> {
        const trackId = Number(reference)
        if (!Number.isSafeInteger(trackId) || trackId <= 0) throw new PaymentGatewayError({
            gateway: this.name,
            stage: 'verify',
            code: 'invalid_track_id'
        })
        const body = await this.post('verify', 'verify', {merchant: this.config.get('ZIBAL_MERCHANT'), trackId})
        switch (body.result) {
            case 100:
            case 201:
                return {
                    status: 'paid',
                    amount: body.amount !== undefined ? Math.round(body.amount / this.multiplier()) : null,
                    trackingCode: body.refNumber !== undefined ? String(body.refNumber) : null,
                    cardMask: body.cardNumber ?? null,
                    paidAt: body.paidAt ? new Date(body.paidAt) : null,
                    failureCode: null
                }
            case 202:
                if (body.status === undefined || body.status === -1) return this.nothing('pending', null);
                return this.nothing('failed', `status_${body.status}`)
            case 203:
                return this.nothing('failed', 'invalid_reference')
            default:
                throw new PaymentGatewayError({gateway: this.name, stage: 'verify', code: String(body.result)})
        }
    }

    private nothing(status: 'pending' | 'failed', failureCode: string | null): GatewayVerification {
        return {status, amount: null, trackingCode: null, cardMask: null, paidAt: null, failureCode}
    }

    private multiplier(): number {
        const n = Number(this.config.getOptional('ZIBAL_AMOUNT_MULTIPLIER') ?? 10);
        return Number.isFinite(n) && n > 0 ? n : 10
    }

    private baseUrl(): string {
        return (this.config.getOptional('ZIBAL_BASE_URL') ?? 'https://gateway.zibal.ir').replace(/\/+$/, '')
    }

    private async post(path: string, stage: string, payload: object): Promise<ZibalResponse> {
        let response: Response
        try {
            response = await fetch(`${this.baseUrl()}/v1/${path}`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000)
            })
        } catch {
            throw new PaymentGatewayError({gateway: this.name, stage, code: 'unreachable'})
        }
        if (!response.ok) throw new PaymentGatewayError({gateway: this.name, stage, code: `http_${response.status}`})
        try {
            return await response.json() as ZibalResponse
        } catch {
            throw new PaymentGatewayError({gateway: this.name, stage, code: 'invalid_json'})
        }
    }
}
