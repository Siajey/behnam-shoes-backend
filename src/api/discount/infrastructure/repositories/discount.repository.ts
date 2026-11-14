import { and, eq, inArray, isNull, lte, gt, or } from 'drizzle-orm'

import {
    Discount, DISCOUNT_FILTER_FIELDS, DISCOUNT_SORT_FIELDS, DiscountListCriteria, DiscountPage,
    IDiscountRepository,
} from '@api/discount/domain'
import { Inject, Injectable } from '@nestjs/common'
import { Database } from '@common/db'
import { DATABASE } from '@common/di'
import { DrizzleGetItemsQueryBuilder } from '@common/db'

import * as schema from '../models/discount.model'
import { DiscountMapper } from '../mappers'

@Injectable()
export class DiscountRepository implements IDiscountRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

    async findById(id: string): Promise<Discount | null> {
        const [row] = await this.db.select().from(schema.discounts).where(eq(schema.discounts.id, id)).limit(1)
        return row ? (await this.hydrate([row]))[0] : null
    }

    async findActiveAt(now: Date): Promise<Discount[]> {
        const d = schema.discounts

        const rows = await this.db
            .select()
            .from(d)
            .where(
                and(
                    eq(d.isActive, true),
                    or(isNull(d.startsAt), lte(d.startsAt, now)),
                    or(isNull(d.endsAt), gt(d.endsAt, now)),
                ),
            )

        return this.hydrate(rows)
    }

    async findAll(criteria: DiscountListCriteria): Promise<DiscountPage> {
        const builder = new DrizzleGetItemsQueryBuilder(
            criteria,
            schema.discounts,
            DISCOUNT_FILTER_FIELDS,
            DISCOUNT_SORT_FIELDS,
        )
            .filter()
            .sort()
            .cursor()
            .pagination()

        const rows = await this.db
            .select()
            .from(schema.discounts)
            .where(builder.buildWhere())
            .orderBy(...builder.orderBy)
            .limit(builder.pageSize + 1)

        const hasMore = rows.length > builder.pageSize
        const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows
        const last = pageRows[pageRows.length - 1]

        return {
            discounts: await this.hydrate(pageRows),
            nextCursor:
                hasMore && last
                    ? DrizzleGetItemsQueryBuilder.encodeCursor(
                        (last as Record<string, unknown>)[builder.sortField],
                        last.id,
                    )
                    : null,
        }
    }

    save(discount: Discount): Promise<void> {
        const { discount: row, targets } = DiscountMapper.toPersistence(discount)
        const { id, ...rest } = row

        return this.db.transaction(async (tx) => {
            await tx
                .insert(schema.discounts)
                .values(row)
                .onConflictDoUpdate({ target: schema.discounts.id, set: rest })

            await tx.delete(schema.discountTargets).where(eq(schema.discountTargets.discountId, id as string))
            if (targets.length) await tx.insert(schema.discountTargets).values(targets)
        })
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.discounts).where(eq(schema.discounts.id, id))
    }

    private async hydrate(rows: (typeof schema.discounts.$inferSelect)[]): Promise<Discount[]> {
        if (rows.length === 0) return []
        const targetRows = await this.db
            .select()
            .from(schema.discountTargets)
            .where(inArray(schema.discountTargets.discountId, rows.map((r) => r.id)))

        const byDiscount = new Map<string, string[]>()
        for (const t of targetRows) {
            byDiscount.set(t.discountId, [...(byDiscount.get(t.discountId) ?? []), t.targetId])
        }
        return rows.map((r) => DiscountMapper.toDomain(r, byDiscount.get(r.id) ?? []))
    }
}