import {Payment, PaymentStatus} from '@api/payment/domain'

export interface StartPaymentCommand {
    orderId: string;
    gateway?: string
}

export interface StartPaymentResult {
    paymentId: string;
    redirectUrl: string
}

export interface PaymentCallbackCommand {
    gateway: string;
    params: Record<string, string>
}

export interface PaymentOutcome {
    paymentId: string;
    orderId: string;
    status: PaymentStatus
}

export interface ReconcileResult {
    checked: number;
    paid: number;
    failed: number;
    expired: number;
    ordersSynced: number
}

export interface IStartPayment {
    execute(command: StartPaymentCommand, userId: string): Promise<StartPaymentResult>
}

export interface IGetPaymentStatus {
    execute(paymentId: string, userId: string): Promise<Payment>
}

export interface IHandlePaymentCallback {
    execute(command: PaymentCallbackCommand): Promise<PaymentOutcome>
}

export interface IConfirmPayment {
    execute(paymentId: string): Promise<PaymentOutcome>
}

export interface IReconcilePayments {
    execute(): Promise<ReconcileResult>
}

export interface IListOrderPayments {
    execute(orderId: string): Promise<Payment[]>
}
