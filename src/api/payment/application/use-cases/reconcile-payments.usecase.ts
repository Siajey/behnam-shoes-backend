import {IPaymentRepository, PaymentGatewayError} from '@api/payment/domain'
import {ConfigProvider} from '@common/configuration'
import {ILogger} from '@common/logger'
import {withPaymentRetry} from '../helpers'
import {IConfirmPayment, IReconcilePayments, ReconcileResult} from '../interfaces'

const MIN_AGE_MINUTES = 5;
const BATCH_SIZE = 100
export default class ReconcilePaymentsUseCase implements IReconcilePayments {
    private running = false

    constructor(
        private readonly payments: IPaymentRepository, private readonly confirm: IConfirmPayment,
        private readonly config: ConfigProvider, private readonly logger: ILogger) {
    }

    async execute(): Promise<ReconcileResult> {
        const result: ReconcileResult = {checked: 0, paid: 0, failed: 0, expired: 0, ordersSynced: 0}
        if (this.running) return result
        this.running = true
        try {
            const now = Date.now();
            const expiryMinutes = Number(this.config.getOptional('PAYMENT_EXPIRY_MINUTES') ?? 60)
            const expireBefore = new Date(now - expiryMinutes * 60_000)
            const open = await this.payments.findRedirectedBefore(new Date(now - MIN_AGE_MINUTES * 60_000), BATCH_SIZE)
            for (const payment of open) {
                result.checked++
                try {
                    const outcome = await this.confirm.execute(payment.id)
                    if (outcome.status === 'paid') result.paid++
                    else if (outcome.status === 'failed') result.failed++
                    else if (outcome.status === 'redirected' && payment.createdAt < expireBefore && await this.expire(payment.id)) result.expired++
                } catch (error) {
                    if (!(error instanceof PaymentGatewayError)) throw error
                }
            }
            const unconfirmed = await this.payments.findPaidUnconfirmed(BATCH_SIZE)
            for (const payment of unconfirmed) {
                result.checked++;
                const outcome = await this.confirm.execute(payment.id);
                if (outcome.status === 'paid') result.ordersSynced++
            }
            if (result.checked) void this.logger.info('Payments reconciled', {
                module: 'ReconcilePaymentsUseCase',
                operation: 'execute',
                event: 'payment.reconcile',
                data: {...result}
            })
            return result
        } finally {
            this.running = false
        }
    }

    private expire(paymentId: string): Promise<boolean> {
        return withPaymentRetry(async () => {
            const payment = await this.payments.findById(paymentId);
            if (!payment || payment.status !== 'redirected') return false
            payment.markExpired();
            await this.payments.save(payment);
            return true
        })
    }
}
