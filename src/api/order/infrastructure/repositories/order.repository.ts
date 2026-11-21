import {Inject, Injectable} from '@nestjs/common'
import {and, asc, eq, gte, inArray, lt, lte, sql, SQL} from 'drizzle-orm'

import {
    AdminOrderListCriteria, IOrderRepository, Order, OrderPage, OrderVersionConflictError, ProductUnitsSold,
} from '@api/order/domain'
import {Database, DrizzleGetItemsQueryBuilder} from '@common/db'
import {DATABASE} from '@common/di'
import {ListQuery} from '@common/dto'

import * as schema from '../models'
import {OrderMapper} from '../mappers'

type OrderRow = typeof schema.orders.$inferSelect

@Injectable()
export class OrderRepository implements IOrderRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async findById(id: string): Promise<Order | null> {
        const [row] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1)
        return row ? (await this.hydrate([row], true))[0] : null
    }

    async findByIdempotencyKey(userId: string, key: string): Promise<Order | null> {
        const [row] = await this.db
            .select()
            .from(schema.orders)
            .where(and(eq(schema.orders.userId, userId), eq(schema.orders.idempotencyKey, key)))
            .limit(1)
        return row ? (await this.hydrate([row], true))[0] : null
    }

    create(order: Order): Promise<number | null> {
        const {order: row, lines, events} = OrderMapper.toPersistence(order)

        return this.db.transaction(async (tx) => {
            const [inserted] = await tx
                .insert(schema.orders)
                .values(row)
                .onConflictDoNothing({target: [schema.orders.userId, schema.orders.idempotencyKey]})
                .returning({orderNumber: schema.orders.orderNumber})

            if (!inserted) return null

            await tx.insert(schema.orderLines).values(lines)
            await tx.insert(schema.orderStatusEvents).values(events)
            return inserted.orderNumber
        })
    }

    save(order: Order): Promise<void> {
        const {order: row, events} = OrderMapper.toPersistence(order)

        return this.db.transaction(async (tx) => {
            const updated = await tx
                .update(schema.orders)
                .set({
                    status: row.status,
                    carrier: row.carrier,
                    trackingCode: row.trackingCode,
                    paidAt: row.paidAt,
                    version: row.version,
                    updatedAt: row.updatedAt,
                })
                .where(and(eq(schema.orders.id, order.id), eq(schema.orders.version, order.version)))
                .returning({id: schema.orders.id})

            if (updated.length === 0) throw new OrderVersionConflictError()

            if (events.length > 0) {
                await tx.insert(schema.orderStatusEvents).values(events).onConflictDoNothing()
            }
        })
    }

    listByUser(userId: string, criteria: ListQuery<never>): Promise<OrderPage> {
        return this.page(criteria, eq(schema.orders.userId, userId))
    }

    listAll(criteria: AdminOrderListCriteria): Promise<OrderPage> {
        const o = schema.orders
        return this.page(
            criteria,
            criteria.statuses?.length ? inArray(o.status, criteria.statuses) : undefined,
            criteria.from ? gte(o.createdAt, criteria.from) : undefined,
            criteria.to ? lte(o.createdAt, criteria.to) : undefined,
            criteria.orderNumber !== undefined ? eq(o.orderNumber, criteria.orderNumber) : undefined,
        )
    }

    async unitsSoldByProduct(since: Date): Promise<ProductUnitsSold[]> {
        const o = schema.orders
        const l = schema.orderLines
        const countedStatuses = ['paid', 'processing', 'shipped', 'delivered'] as const

        return this.db
            .select({
                productId: l.productId,
                unitsSold: sql<number>`sum(${l.quantity})`.mapWith(Number),
            })
            .from(l)
            .innerJoin(o, eq(l.orderId, o.id))
            .where(and(gte(o.paidAt, since), inArray(o.status, [...countedStatuses])))
            .groupBy(l.productId)
    }

    async findExpirable(now: Date, limit: number): Promise<Order[]> {
        const rows = await this.db
            .select()
            .from(schema.orders)
            .where(
                and(
                    eq(schema.orders.status, 'pending_payment'),
                    lt(schema.orders.expiresAt, now),
                ),
            )
            .orderBy(asc(schema.orders.expiresAt))
            .limit(limit)
        return this.hydrate(rows, false)
    }

    private async page(
        criteria: ListQuery<never>,
        ...conditions: (SQL | undefined)[]
    ): Promise<OrderPage> {
        const builder = new DrizzleGetItemsQueryBuilder<never, 'createdAt'>(
            {...criteria, sort: undefined},
            schema.orders,
            [],
            ['createdAt'],
        )
            .sort()
            .cursor()
            .pagination()

        const rows = await this.db
            .select()
            .from(schema.orders)
            .where(and(...conditions, builder.buildWhere()))
            .orderBy(...builder.orderBy)
            .limit(builder.pageSize + 1)

        const hasMore = rows.length > builder.pageSize
        const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows
        const last = pageRows[pageRows.length - 1]

        return {
            orders: await this.hydrate(pageRows, false),
            nextCursor:
                hasMore && last
                    ? DrizzleGetItemsQueryBuilder.encodeCursor(
                        (last as Record<string, unknown>)[builder.sortField],
                        last.id,
                    )
                    : null,
        }
    }

    private async hydrate(rows: OrderRow[], withEvents: boolean): Promise<Order[]> {
        if (rows.length === 0) return []
        const ids = rows.map((r) => r.id)

        const lineRows = await this.db
            .select()
            .from(schema.orderLines)
            .where(inArray(schema.orderLines.orderId, ids))

        const eventRows: (typeof schema.orderStatusEvents.$inferSelect)[] = withEvents
            ? await this.db
                .select()
                .from(schema.orderStatusEvents)
                .where(inArray(schema.orderStatusEvents.orderId, ids))
            : []

        const group = <T extends { orderId: string }>(items: T[]) => {
            const map = new Map<string, T[]>()
            for (const item of items) map.set(item.orderId, [...(map.get(item.orderId) ?? []), item])
            return map
        }
        const linesByOrder = group(lineRows)
        const eventsByOrder = group(eventRows)

        return rows.map((r) =>
            OrderMapper.toDomain(r, linesByOrder.get(r.id) ?? [], eventsByOrder.get(r.id) ?? []),
        )
    }
}