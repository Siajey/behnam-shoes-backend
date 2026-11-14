import { randomUUID } from 'node:crypto'

import { toLatinDigits } from '@common/util'

import { InvalidCouponError } from '../errors'
import {
    CouponInvalidReason, DiscountKind, DiscountScope, isValidCap, isValidDiscountValue,
    isValidPeriod, isValidScope, isWithinPeriod, normalizeScope, PricingLine, scopeMatches,
} from '../value-objects'

export interface CouponInput {
    name: string
    kind: DiscountKind
    value: number
    maxDiscount: number | null
    minOrderAmount: number | null
    scope: DiscountScope
    applyToDiscountedItems: boolean
    startsAt: Date | null
    endsAt: Date | null
    usageLimitTotal: number | null
    usageLimitPerUser: number | null
    isActive: boolean
}

export interface CouponProps extends CouponInput {
    id: string
    code: string
    createdAt: Date
    updatedAt: Date
}

const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/
const isValidLimit = (n: number | null): boolean => n === null || (Number.isInteger(n) && n >= 1)

export class Coupon {
    private constructor(private props: CouponProps) {}

    static normalizeCode(raw: string): string {
        return toLatinDigits(raw.trim()).toUpperCase()
    }

    static create(
        input: Pick<CouponInput, 'name' | 'kind' | 'value' | 'scope'> &
            Partial<CouponInput> & { code: string },
    ): Coupon {
        const code = Coupon.normalizeCode(input.code)
        if (!CODE_PATTERN.test(code)) throw new InvalidCouponError('code')

        const now = new Date()
        const data = Coupon.validated({
            name: input.name,
            kind: input.kind,
            value: input.value,
            scope: input.scope,
            maxDiscount: input.maxDiscount ?? null,
            minOrderAmount: input.minOrderAmount ?? null,
            applyToDiscountedItems: input.applyToDiscountedItems ?? false,
            startsAt: input.startsAt ?? null,
            endsAt: input.endsAt ?? null,
            usageLimitTotal: input.usageLimitTotal ?? null,
            usageLimitPerUser: input.usageLimitPerUser ?? null,
            isActive: input.isActive ?? true,
        })
        return new Coupon({ id: randomUUID(), code, ...data, createdAt: now, updatedAt: now })
    }

    static restore(props: CouponProps): Coupon {
        return new Coupon(props)
    }

    private static validated(data: CouponInput): CouponInput {
        const scope = normalizeScope(data.scope)
        if (!isValidDiscountValue(data.kind, data.value)) throw new InvalidCouponError('value')
        if (!isValidCap(data.maxDiscount)) throw new InvalidCouponError('cap')
        if (!isValidCap(data.minOrderAmount)) throw new InvalidCouponError('minOrder')
        if (!isValidScope(scope)) throw new InvalidCouponError('scope')
        if (!isValidPeriod(data.startsAt, data.endsAt)) throw new InvalidCouponError('period')
        if (!isValidLimit(data.usageLimitTotal) || !isValidLimit(data.usageLimitPerUser)) {
            throw new InvalidCouponError('limit')
        }
        return { ...data, scope }
    }

    get id() { return this.props.id }
    get code() { return this.props.code }
    get name() { return this.props.name }
    get kind() { return this.props.kind }
    get value() { return this.props.value }
    get maxDiscount() { return this.props.maxDiscount }
    get minOrderAmount() { return this.props.minOrderAmount }
    get scope(): DiscountScope { return this.props.scope }
    get applyToDiscountedItems() { return this.props.applyToDiscountedItems }
    get startsAt() { return this.props.startsAt }
    get endsAt() { return this.props.endsAt }
    get usageLimitTotal() { return this.props.usageLimitTotal }
    get usageLimitPerUser() { return this.props.usageLimitPerUser }
    get isActive() { return this.props.isActive }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    update(changes: Partial<CouponInput>): void {
        const defined = Object.fromEntries(
            Object.entries(changes).filter(([, v]) => v !== undefined),
        ) as Partial<CouponInput>

        const data = Coupon.validated({
            name: this.props.name,
            kind: this.props.kind,
            value: this.props.value,
            maxDiscount: this.props.maxDiscount,
            minOrderAmount: this.props.minOrderAmount,
            scope: this.props.scope,
            applyToDiscountedItems: this.props.applyToDiscountedItems,
            startsAt: this.props.startsAt,
            endsAt: this.props.endsAt,
            usageLimitTotal: this.props.usageLimitTotal,
            usageLimitPerUser: this.props.usageLimitPerUser,
            isActive: this.props.isActive,
            ...defined,
        })
        Object.assign(this.props, data, { updatedAt: new Date() })
    }

    appliesTo(line: PricingLine): boolean {
        return scopeMatches(this.props.scope, line)
    }

    invalidReason(now: Date, usage: { total: number; user: number }): CouponInvalidReason | null {
        const p = this.props
        if (!p.isActive) return 'inactive'
        if (p.startsAt && now < p.startsAt) return 'notStarted'
        if (!isWithinPeriod(now, p.startsAt, p.endsAt)) return 'expired'
        if (p.usageLimitTotal !== null && usage.total >= p.usageLimitTotal) return 'totalLimitReached'
        if (p.usageLimitPerUser !== null && usage.user >= p.usageLimitPerUser) return 'userLimitReached'
        return null
    }
}