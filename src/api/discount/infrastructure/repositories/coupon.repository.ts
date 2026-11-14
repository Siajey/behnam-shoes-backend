import { eq, inArray } from 'drizzle-orm'

import {
    Coupon, COUPON_FILTER_FIELDS, COUPON_SORT_FIELDS, CouponListCriteria, CouponPage, ICouponRepository,
} from '@api/discount/domain'
import { Inject, Injectable } from '@nestjs/common'
import { Database } from '@common/db'
import { DATABASE } from '@common/di'
import { DrizzleGetItemsQueryBuilder } from '@common/db/infrastructure'

import { CouponMapper } from '../mappers'
import * as schema from '../models/coupon.model'

@Injectable()
export class CouponRepository implements ICouponRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

    async findById(id: string): Promise<Coupon | null> {
        const [row] = await this.db.select().from(schema.coupons).where(eq(schema.coupons.id, id)).limit(1)
        return row ? (await this.hydrate([row]))[0] : null
    }

    async findByCode(code: string): Promise<Coupon | null> {
        const [row] = await this.db.select().from(schema.coupons).where(eq(schema.coupons.code, code)).limit(1)
        return row ? (await this.hydrate([row]))[0] : null
    }

    async codeExists(code: string): Promise<boolean> {
        const [row] = await this.db
            .select({ id: schema.coupons.id })
            .from(schema.coupons)
            .where(eq(schema.coupons.code, code))
            .limit(1)
        return !!row
    }

    async findAll(criteria: CouponListCriteria): Promise<CouponPage> {
        const builder = new DrizzleGetItemsQueryBuilder(
            criteria,
            schema.coupons,
            COUPON_FILTER_FIELDS,
            COUPON_SORT_FIELDS,
        )
            .filter()
            .sort()
            .cursor()
            .pagination()

        const rows = await this.db
            .select()
            .from(schema.coupons)
            .where(builder.buildWhere())
            .orderBy(...builder.orderBy)
            .limit(builder.pageSize + 1)

        const hasMore = rows.length > builder.pageSize
        const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows
        const last = pageRows[pageRows.length - 1]

        return {
            coupons: await this.hydrate(pageRows),
            nextCursor:
                hasMore && last
                    ? DrizzleGetItemsQueryBuilder.encodeCursor(
                        (last as Record<string, unknown>)[builder.sortField],
                        last.id,
                    )
                    : null,
        }
    }

    save(coupon: Coupon): Promise<void> {
        const { coupon: row, targets } = CouponMapper.toPersistence(coupon)
        const { id, ...rest } = row

        return this.db.transaction(async (tx) => {
            await tx
                .insert(schema.coupons)
                .values(row)
                .onConflictDoUpdate({ target: schema.coupons.id, set: rest })

            await tx.delete(schema.couponTargets).where(eq(schema.couponTargets.couponId, id as string))
            if (targets.length) await tx.insert(schema.couponTargets).values(targets)
        })
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.coupons).where(eq(schema.coupons.id, id))
    }

    private async hydrate(rows: (typeof schema.coupons.$inferSelect)[]): Promise<Coupon[]> {
        if (rows.length === 0) return []
        const targetRows = await this.db
            .select()
            .from(schema.couponTargets)
            .where(inArray(schema.couponTargets.couponId, rows.map((r) => r.id)))

        const byCoupon = new Map<string, string[]>()
        for (const t of targetRows) {
            byCoupon.set(t.couponId, [...(byCoupon.get(t.couponId) ?? []), t.targetId])
        }
        return rows.map((r) => CouponMapper.toDomain(r, byCoupon.get(r.id) ?? []))
    }
}