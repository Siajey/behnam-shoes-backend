import {Inject, Injectable} from '@nestjs/common'
import {and, asc, desc, eq, gte, inArray, lte, notInArray, SQL} from 'drizzle-orm'

import {
    FINAL_TRACKING_STATUSES,
    IShipmentRepository,
    Shipment,
    ShipmentVersionConflictError,
} from '@api/shipping/domain'
import {Database} from '@common/db'
import {DATABASE} from '@common/di'
import * as schema from '../models/shipment.model'

import {ShipmentMapper} from '../mappers'

@Injectable()
export class ShipmentRepository implements IShipmentRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async findByOrderId(orderId: string): Promise<Shipment | null> {
        return (await this.many(eq(schema.shipments.orderId, orderId)))[0] ?? null
    }

    findByOrderIds(orderIds: string[]): Promise<Shipment[]> {
        if (orderIds.length === 0) return Promise.resolve([])
        return this.many(inArray(schema.shipments.orderId, orderIds))
    }

    async create(shipment: Shipment): Promise<boolean> {
        const {shipment: row, events} = ShipmentMapper.toPersistence(shipment)
        return this.db.transaction(async (tx) => {
            const inserted = await tx
                .insert(schema.shipments)
                .values(row)
                .onConflictDoNothing({target: schema.shipments.orderId})
                .returning({id: schema.shipments.id})
            if (inserted.length === 0) return false

            if (events.length > 0) await tx.insert(schema.shipmentEvents).values(events).onConflictDoNothing()
            return true
        })
    }

    async save(shipment: Shipment): Promise<void> {
        const {shipment: row, events} = ShipmentMapper.toPersistence(shipment)

        await this.db.transaction(async (tx) => {
            const updated = await tx
                .update(schema.shipments)
                .set({
                    methodCode: row.methodCode,
                    carrier: row.carrier,
                    trackingCode: row.trackingCode,
                    status: row.status,
                    deliveredAt: row.deliveredAt,
                    lastCheckedAt: row.lastCheckedAt,
                    nextCheckAt: row.nextCheckAt,
                    failureCount: row.failureCount,
                    version: shipment.version + 1,
                    updatedAt: row.updatedAt,
                })
                .where(and(eq(schema.shipments.id, shipment.id), eq(schema.shipments.version, shipment.version)))
                .returning({id: schema.shipments.id})
            if (updated.length === 0) throw new ShipmentVersionConflictError()

            const keys = events.map((e) => e.eventKey)
            await tx
                .delete(schema.shipmentEvents)
                .where(
                    keys.length > 0
                        ? and(
                            eq(schema.shipmentEvents.shipmentId, shipment.id),
                            notInArray(schema.shipmentEvents.eventKey, keys),
                        )
                        : eq(schema.shipmentEvents.shipmentId, shipment.id),
                )
            if (events.length > 0) await tx.insert(schema.shipmentEvents).values(events).onConflictDoNothing()
        })
    }

    findDueForPolling(input: {
        now: Date
        limit: number
        carriers: string[]
        createdAfter: Date
    }): Promise<Shipment[]> {
        if (input.carriers.length === 0) return Promise.resolve([])
        return this.many(
            and(
                notInArray(schema.shipments.status, [...FINAL_TRACKING_STATUSES]),
                lte(schema.shipments.nextCheckAt, input.now),
                gte(schema.shipments.createdAt, input.createdAfter),
                inArray(schema.shipments.carrier, input.carriers),
            ),
            input.limit,
        )
    }

    async findDeliveredOrderIds(since: Date, limit: number): Promise<string[]> {
        const rows = await this.db
            .select({orderId: schema.shipments.orderId})
            .from(schema.shipments)
            .where(
                and(eq(schema.shipments.status, 'delivered'), gte(schema.shipments.deliveredAt, since)),
            )
            .orderBy(desc(schema.shipments.deliveredAt))
            .limit(limit)
        return rows.map((r) => r.orderId)
    }

    private async many(condition: SQL | undefined, limit?: number): Promise<Shipment[]> {
        const query = this.db
            .select()
            .from(schema.shipments)
            .where(condition)
            .orderBy(asc(schema.shipments.nextCheckAt))
        const rows = await (limit ? query.limit(limit) : query)
        if (rows.length === 0) return []

        const eventRows = await this.db
            .select()
            .from(schema.shipmentEvents)
            .where(inArray(schema.shipmentEvents.shipmentId, rows.map((r) => r.id)))

        return rows.map((row) =>
            ShipmentMapper.toDomain(row, eventRows.filter((e) => e.shipmentId === row.id)),
        )
    }
}
