import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {
    ICommitCouponRedemption, IPriceCatalog,
    IPriceItems,
    IReleaseCouponRedemption,
    IReserveCoupon,
} from '@api/discount/application'
import {
    COMMIT_COUPON_REDEMPTION, PRICE_CATALOG,
    PRICE_ITEMS,
    RELEASE_COUPON_REDEMPTION,
    RESERVE_COUPON,
} from '@common/di'

import {Api, randomId, uid} from '../../../util/test.util'

/* Discount/coupon helpers. Shared helpers live in test/util/test.util. */

export const HOUR = 3_600_000
export const DAY = 24 * HOUR
/** ISO timestamp `ms` from now (negative = past). */
export const isoFromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

export const scope = (type: string, ...targetIds: string[]) => ({type, targetIds})
export const ALL = scope('all')

/* ------------------------------------------------------------------ */
/* System use cases (called by cart/order, no HTTP endpoint)           */
/* ------------------------------------------------------------------ */

export const discountUseCases = (app: NestFastifyApplication) => ({
    priceItems: app.get<IPriceItems>(PRICE_ITEMS, {strict: false}),
    reserveCoupon: app.get<IReserveCoupon>(RESERVE_COUPON, {strict: false}),
    commitRedemption: app.get<ICommitCouponRedemption>(COMMIT_COUPON_REDEMPTION, {strict: false}),
    releaseRedemption: app.get<IReleaseCouponRedemption>(RELEASE_COUPON_REDEMPTION, {strict: false}),
    priceCatalog: app.get<IPriceCatalog>(PRICE_CATALOG, {strict: false}),
})

export interface TestLine {
    variantId: string
    productId: string
    categoryId: string | null
    brandId: string | null
    unitPrice: number
    quantity: number
}

/** A pricing line with random ids, so discounts scoped to other ids can never match it. */
export const line = (overrides: Partial<TestLine> = {}): TestLine => ({
    variantId: randomId(),
    productId: randomId(),
    categoryId: null,
    brandId: null,
    unitPrice: 1000,
    quantity: 1,
    ...overrides,
})

/* ------------------------------------------------------------------ */
/* Admin factories                                                     */
/* ------------------------------------------------------------------ */

export const discountBody = (overrides: Record<string, unknown> = {}) => ({
    name: `Discount ${uid()}`,
    kind: 'percent',
    value: 10,
    scope: ALL,
    ...overrides,
})

export const couponBody = (overrides: Record<string, unknown> = {}) => ({
    code: `C${uid()}`.toUpperCase(),
    name: `Coupon ${uid()}`,
    kind: 'percent',
    value: 10,
    scope: ALL,
    ...overrides,
})

export const createDiscount = async (admin: Api, overrides: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/discounts', discountBody(overrides))
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const createCoupon = async (admin: Api, overrides: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/coupons', couponBody(overrides))
    expect(res.statusCode).toBe(201)
    return res.json().data
}

/**
 * Discounts are global (every active discount whose scope matches is considered), so specs that create
 * broad ones (scope "all", category, brand) delete them again in afterEach with `cleanup()`.
 */
export const discountTracker = (admin: Api) => {
    const ids: string[] = []
    return {
        create: async (overrides: Record<string, unknown> = {}) => {
            const discount = await createDiscount(admin, overrides)
            ids.push(discount.id)
            return discount
        },
        cleanup: async () => {
            for (const id of ids.splice(0)) await admin.delete(`/admin/discounts/${id}`)
        },
    }
}
