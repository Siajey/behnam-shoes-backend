import {Payment} from '../entities'

export interface IPaymentRepository {
    findById(id: string): Promise<Payment | null>

    findByGatewayReference(gateway: string, reference: string): Promise<Payment | null>

    findByOrderId(orderId: string): Promise<Payment[]>

    create(payment: Payment): Promise<void>

    save(payment: Payment): Promise<void>

    findRedirectedBefore(before: Date, limit: number): Promise<Payment[]>

    findPaidUnconfirmed(limit: number): Promise<Payment[]>
}
