import { Coupon, Discount } from '@api/discount/domain'

import { couponTargets, coupons, discounts, discountTargets } from '../models'

const toDate = (value: Date | null): Date | null => (value ? new Date(value) : null)

export class DiscountMapper {
    static toDomain(row: typeof discounts.$inferSelect, targetIds: string[]): Discount {
        return Discount.restore({
            id: row.id,
            name: row.name,
            kind: row.kind,
            value: row.value,
            maxDiscountPerUnit: row.maxDiscountPerUnit,
            scope: { type: row.scopeType, targetIds },
            startsAt: toDate(row.startsAt),
            endsAt: toDate(row.endsAt),
            isActive: row.isActive,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(d: Discount): {
        discount: typeof discounts.$inferInsert
        targets: (typeof discountTargets.$inferInsert)[]
    } {
        return {
            discount: {
                id: d.id,
                name: d.name,
                kind: d.kind,
                value: d.value,
                maxDiscountPerUnit: d.maxDiscountPerUnit,
                scopeType: d.scope.type,
                startsAt: d.startsAt ?? null,
                endsAt: d.endsAt ?? null,
                isActive: d.isActive,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
            },
            targets: d.scope.targetIds.map((targetId) => ({ discountId: d.id, targetId })),
        }
    }
}

export class CouponMapper {
    static toDomain(row: typeof coupons.$inferSelect, targetIds: string[]): Coupon {
        return Coupon.restore({
            id: row.id,
            code: row.code,
            name: row.name,
            kind: row.kind,
            value: row.value,
            maxDiscount: row.maxDiscount,
            minOrderAmount: row.minOrderAmount,
            scope: { type: row.scopeType, targetIds },
            applyToDiscountedItems: row.applyToDiscountedItems,
            startsAt: toDate(row.startsAt),
            endsAt: toDate(row.endsAt),
            usageLimitTotal: row.usageLimitTotal,
            usageLimitPerUser: row.usageLimitPerUser,
            isActive: row.isActive,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(c: Coupon): {
        coupon: typeof coupons.$inferInsert
        targets: (typeof couponTargets.$inferInsert)[]
    } {
        return {
            coupon: {
                id: c.id,
                code: c.code,
                name: c.name,
                kind: c.kind,
                value: c.value,
                maxDiscount: c.maxDiscount,
                minOrderAmount: c.minOrderAmount,
                scopeType: c.scope.type,
                applyToDiscountedItems: c.applyToDiscountedItems,
                startsAt: c.startsAt ?? null,
                endsAt: c.endsAt ?? null,
                usageLimitTotal: c.usageLimitTotal,
                usageLimitPerUser: c.usageLimitPerUser,
                isActive: c.isActive,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            },
            targets: c.scope.targetIds.map((targetId) => ({ couponId: c.id, targetId })),
        }
    }
}