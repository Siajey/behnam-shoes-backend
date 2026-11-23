import {Inject, Injectable} from '@nestjs/common'
import {and, asc, desc, eq, isNull, lt, SQL} from 'drizzle-orm'

import {IPaymentRepository, Payment, PaymentVersionConflictError} from '@api/payment/domain'
import {Database} from '@common/db'
import {DATABASE} from '@common/di'
import {PaymentMapper} from '../mappers'

import * as schema from '../models'

@Injectable()
export class PaymentRepository implements IPaymentRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    findById(id: string): Promise<Payment | null> {
        return this.one(eq(schema.payments.id, id))
    }

    findByGatewayReference(gateway: string, reference: string): Promise<Payment | null> {
        return this.one(and(eq(schema.payments.gateway, gateway), eq(schema.payments.reference, reference)))
    }

    async findByOrderId(orderId: string): Promise<Payment[]> {
        const rows = await this.db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(desc(schema.payments.createdAt))
        return rows.map(PaymentMapper.toDomain)
    }

    async create(payment: Payment): Promise<void> {
        const row = PaymentMapper.toPersistence(payment)
        await this.db.insert(schema.payments).values(row)
        payment.markPersisted(row.version)
    }

    async save(payment: Payment): Promise<void> {
        const row = PaymentMapper.toPersistence(payment)
        const updated = await this.db
            .update(schema.payments)
            .set({
                status: row.status,
                reference: row.reference,
                trackingCode: row.trackingCode,
                cardMask: row.cardMask,
                failureReason: row.failureReason,
                paidAt: row.paidAt,
                orderConfirmedAt: row.orderConfirmedAt,
                version: row.version,
                updatedAt: row.updatedAt,
            })
            .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.version, payment.version)))
            .returning({id: schema.payments.id})

        if (!updated.length) throw new PaymentVersionConflictError()
        payment.markPersisted(row.version)
    }

    async findRedirectedBefore(before: Date, limit: number): Promise<Payment[]> {
        const rows = await this.db.select().from(schema.payments).where(and(eq(schema.payments.status, 'redirected'), lt(schema.payments.createdAt, before)))
            .orderBy(asc(schema.payments.createdAt)).limit(limit)
        return rows.map(PaymentMapper.toDomain)
    }

    async findPaidUnconfirmed(limit: number): Promise<Payment[]> {
        const rows = await this.db.select().from(schema.payments).where(and(eq(schema.payments.status, 'paid'), isNull(schema.payments.orderConfirmedAt)))
            .orderBy(asc(schema.payments.createdAt)).limit(limit)
        return rows.map(PaymentMapper.toDomain)
    }

    private async one(condition: SQL | undefined): Promise<Payment | null> {
        const [row] = await this.db.select().from(schema.payments).where(condition).limit(1)
        return row ? PaymentMapper.toDomain(row) : null
    }
}
