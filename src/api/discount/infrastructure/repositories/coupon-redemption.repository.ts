import {and, eq, inArray, sql} from 'drizzle-orm'

import {
    CouponNotFoundError, CouponUsage, ICouponRedemptionRepository, ReserveOutcome,
    ReserveRedemptionInput,
} from '@api/discount/domain'
import {Inject, Injectable} from '@nestjs/common'
import {Database} from '@common/db'
import {DATABASE} from '@common/di'

import * as schema from '../models/coupon.model'

const ACTIVE = ['reserved', 'committed'] as const

@Injectable()
export class CouponRedemptionRepository implements ICouponRedemptionRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async countActive(couponId: string): Promise<number> {
        const r = schema.couponRedemptions
        const [row] = await this.db
            .select({count: sql<number>`count(*)`.mapWith(Number)})
            .from(r)
            .where(and(eq(r.couponId, couponId), inArray(r.status, ACTIVE)))
        return row?.count ?? 0
    }

    async countActiveForUser(couponId: string, userId: string): Promise<number> {
        const r = schema.couponRedemptions
        const [row] = await this.db
            .select({count: sql<number>`count(*)`.mapWith(Number)})
            .from(r)
            .where(and(eq(r.couponId, couponId), eq(r.userId, userId), inArray(r.status, ACTIVE)))
        return row?.count ?? 0
    }

    reserveIfAllowed(input: ReserveRedemptionInput): Promise<ReserveOutcome> {
        const r = schema.couponRedemptions

        return this.db.transaction(async (tx) => {
            const [coupon] = await tx
                .select({
                    total: schema.coupons.usageLimitTotal,
                    perUser: schema.coupons.usageLimitPerUser,
                })
                .from(schema.coupons)
                .where(eq(schema.coupons.id, input.couponId))
                .for('update')
                .limit(1)
            if (!coupon) throw new CouponNotFoundError({id: input.couponId})


            const [existing] = await tx
                .select({id: r.id})
                .from(r)
                .where(and(eq(r.couponId, input.couponId), eq(r.orderId, input.orderId)))
                .limit(1)
            if (existing) return 'reserved'

            const count = async (extra?: ReturnType<typeof eq>) => {
                const [row] = await tx
                    .select({count: sql<number>`count(*)`.mapWith(Number)})
                    .from(r)
                    .where(and(eq(r.couponId, input.couponId), inArray(r.status, ACTIVE), extra))
                return row?.count ?? 0
            }

            if (coupon.total !== null && (await count()) >= coupon.total) return 'totalLimitReached'
            if (coupon.perUser !== null && (await count(eq(r.userId, input.userId))) >= coupon.perUser) {
                return 'userLimitReached'
            }

            await tx.insert(r).values({
                couponId: input.couponId,
                userId: input.userId,
                orderId: input.orderId,
                discountAmount: input.discountAmount,
                status: 'reserved',
            })
            return 'reserved'
        })
    }

    async commit(orderId: string): Promise<void> {
        await this.transition(orderId, 'committed')
    }

    async release(orderId: string): Promise<void> {
        await this.transition(orderId, 'released')
    }

    async hasAny(couponId: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.couponRedemptions.id})
            .from(schema.couponRedemptions)
            .where(eq(schema.couponRedemptions.couponId, couponId))
            .limit(1)
        return !!row
    }

    async usage(couponId: string): Promise<CouponUsage> {
        const r = schema.couponRedemptions
        const rows = await this.db
            .select({
                status: r.status,
                count: sql<number>`count(*)`.mapWith(Number),
                amount: sql<number>`coalesce(sum(
                ${r.discountAmount}
                ),
                0
                )`.mapWith(Number),
            })
            .from(r)
            .where(eq(r.couponId, couponId))
            .groupBy(r.status)

        const usage: CouponUsage = {reserved: 0, committed: 0, released: 0, totalDiscount: 0}
        for (const row of rows) {
            usage[row.status] = row.count
            if (row.status !== 'released') usage.totalDiscount += row.amount
        }
        return usage
    }

    private async transition(orderId: string, to: 'committed' | 'released'): Promise<void> {
        const r = schema.couponRedemptions
        await this.db
            .update(r)
            .set({status: to, updatedAt: new Date()})
            .where(and(eq(r.orderId, orderId), eq(r.status, 'reserved')))
    }
}