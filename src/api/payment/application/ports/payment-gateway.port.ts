export interface GatewayPaymentRequest {
    paymentId: string;
    amount: number;
    callbackUrl: string;
    description: string
}

export interface GatewayPaymentTarget {
    reference: string;
    redirectUrl: string
}

export interface GatewayCallback {
    reference: string
}

export interface GatewayVerification {
    status: 'paid' | 'pending' | 'failed';
    amount: number | null;
    trackingCode: string | null
    cardMask: string | null;
    paidAt: Date | null;
    failureCode: string | null
}

export interface IPaymentGateway {
    readonly name: string;
    readonly currencies: readonly string[]

    requestPayment(request: GatewayPaymentRequest): Promise<GatewayPaymentTarget>

    parseCallback(params: Record<string, string>): GatewayCallback | null

    verify(reference: string): Promise<GatewayVerification>
}

export interface IPaymentGatewayRegistry {
    get(name: string): IPaymentGateway;

    defaultName(): string
}
