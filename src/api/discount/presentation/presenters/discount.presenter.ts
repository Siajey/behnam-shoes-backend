import { Coupon, CouponUsage, Discount } from '@api/discount/domain'

export class DiscountPresenter {
    static discount(d: Discount) {
        return {
            id: d.id,
            name: d.name,
            kind: d.kind,
            value: d.value,
            maxDiscountPerUnit: d.maxDiscountPerUnit,
            scope: { type: d.scope.type, targetIds: d.scope.targetIds },
            startsAt: d.startsAt?.toISOString() ?? null,
            endsAt: d.endsAt?.toISOString() ?? null,
            isActive: d.isActive,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
        }
    }

    static coupon(c: Coupon) {
        return {
            id: c.id,
            code: c.code,
            name: c.name,
            kind: c.kind,
            value: c.value,
            maxDiscount: c.maxDiscount,
            minOrderAmount: c.minOrderAmount,
            scope: { type: c.scope.type, targetIds: c.scope.targetIds },
            applyToDiscountedItems: c.applyToDiscountedItems,
            startsAt: c.startsAt?.toISOString() ?? null,
            endsAt: c.endsAt?.toISOString() ?? null,
            usageLimitTotal: c.usageLimitTotal,
            usageLimitPerUser: c.usageLimitPerUser,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }
    }

    static usage(u: CouponUsage) {
        return {
            reserved: u.reserved,
            committed: u.committed,
            released: u.released,
            totalDiscount: u.totalDiscount,
        }
    }
}