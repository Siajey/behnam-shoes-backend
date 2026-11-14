import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, createUserSession, expectError, randomId} from '../../../util/test.util'
import {createCoupon, discountUseCases} from './discount-test.util'

describe('Coupon redemptions (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession
    let other: UserSession
    let uc: ReturnType<typeof discountUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
        other = await createUserSession(ctx)
        uc = discountUseCases(ctx.app)
    })

    const reserve = (couponId: string, userId: string, orderId = randomId(), discountAmount = 100) =>
        uc.reserveCoupon.execute({couponId, userId, orderId, discountAmount})

    const usage = async (couponId: string) => {
        const res = await admin.get(`/admin/coupons/${couponId}/usage`)
        expect(res.statusCode).toBe(200)
        return res.json().data
    }

    const limitReached = (reason: string) => ({code: 'COUPON_LIMIT_REACHED', status: 409, details: {reason}})

    describe('reserve', () => {
        it('reserves a coupon for an order', async () => {
            const coupon = await createCoupon(admin)

            await expect(reserve(coupon.id, user.userId, randomId(), 250)).resolves.toBeUndefined()

            expect(await usage(coupon.id)).toEqual({reserved: 1, committed: 0, released: 0, totalDiscount: 250})
        })

        it('is idempotent for the same order', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            const orderId = randomId()

            await reserve(coupon.id, user.userId, orderId)
            await expect(reserve(coupon.id, user.userId, orderId)).resolves.toBeUndefined()

            expect((await usage(coupon.id)).reserved).toBe(1)
        })

        it('rejects an unknown coupon', async () => {
            await expect(reserve(randomId(), user.userId)).rejects.toMatchObject({code: 'COUPON_NOT_FOUND', status: 404})
        })

        it('enforces the total limit', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            await reserve(coupon.id, user.userId)

            await expect(reserve(coupon.id, other.userId)).rejects.toMatchObject(limitReached('totalLimitReached'))
            expect((await usage(coupon.id)).reserved).toBe(1)
        })

        it('enforces the per-user limit but lets other users in', async () => {
            const coupon = await createCoupon(admin, {usageLimitPerUser: 1})
            await reserve(coupon.id, user.userId)

            await expect(reserve(coupon.id, user.userId)).rejects.toMatchObject(limitReached('userLimitReached'))
            await expect(reserve(coupon.id, other.userId)).resolves.toBeUndefined()
        })

        it('reports the total limit when both limits are reached', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1, usageLimitPerUser: 1})
            await reserve(coupon.id, user.userId)

            await expect(reserve(coupon.id, user.userId)).rejects.toMatchObject(limitReached('totalLimitReached'))
        })

        it('has no limit when none is configured', async () => {
            const coupon = await createCoupon(admin)

            for (let i = 0; i < 5; i++) await reserve(coupon.id, user.userId)

            expect((await usage(coupon.id)).reserved).toBe(5)
        })

        it('lets exactly one of two parallel reservations win the last slot', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})

            const results = await Promise.allSettled([
                reserve(coupon.id, user.userId),
                reserve(coupon.id, other.userId),
            ])

            expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
            const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            expect(rejected).toHaveLength(1)
            expect(rejected[0].reason).toMatchObject(limitReached('totalLimitReached'))
            expect((await usage(coupon.id)).reserved).toBe(1)
        })

        it('never exceeds the limit under many parallel reservations', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 3})

            const results = await Promise.allSettled(
                Array.from({length: 8}, (_, i) => reserve(coupon.id, i % 2 ? user.userId : other.userId)),
            )

            expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
            expect((await usage(coupon.id)).reserved).toBe(3)
        })
    })

    describe('commit and release', () => {
        it('commit turns a reservation into a committed redemption that still counts', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            const orderId = randomId()
            await reserve(coupon.id, user.userId, orderId, 400)

            await uc.commitRedemption.execute(orderId)

            expect(await usage(coupon.id)).toEqual({reserved: 0, committed: 1, released: 0, totalDiscount: 400})
            await expect(reserve(coupon.id, other.userId)).rejects.toMatchObject(limitReached('totalLimitReached'))
        })

        it('release frees the slot and drops the amount from the total discount', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            const orderId = randomId()
            await reserve(coupon.id, user.userId, orderId, 400)

            await uc.releaseRedemption.execute(orderId)

            expect(await usage(coupon.id)).toEqual({reserved: 0, committed: 0, released: 1, totalDiscount: 0})
            await expect(reserve(coupon.id, other.userId)).resolves.toBeUndefined()
        })

        it('only transitions reservations: a committed one cannot be released and a released one cannot be committed', async () => {
            const coupon = await createCoupon(admin)
            const committed = randomId()
            const released = randomId()
            await reserve(coupon.id, user.userId, committed, 100)
            await reserve(coupon.id, user.userId, released, 200)
            await uc.commitRedemption.execute(committed)
            await uc.releaseRedemption.execute(released)

            await uc.releaseRedemption.execute(committed)
            await uc.commitRedemption.execute(released)

            expect(await usage(coupon.id)).toEqual({reserved: 0, committed: 1, released: 1, totalDiscount: 100})
        })

        it('is idempotent and ignores orders without a redemption', async () => {
            const coupon = await createCoupon(admin)
            const orderId = randomId()
            await reserve(coupon.id, user.userId, orderId)

            await uc.commitRedemption.execute(orderId)
            await uc.commitRedemption.execute(orderId)
            await expect(uc.commitRedemption.execute(randomId())).resolves.toBeUndefined()
            await expect(uc.releaseRedemption.execute(randomId())).resolves.toBeUndefined()

            expect((await usage(coupon.id)).committed).toBe(1)
        })
    })

    describe('usage endpoint and deletion', () => {
        it('summarises counts per status and sums the discount of reserved and committed redemptions', async () => {
            const coupon = await createCoupon(admin)
            const [a, b, c, d] = [randomId(), randomId(), randomId(), randomId()]
            await reserve(coupon.id, user.userId, a, 100)
            await reserve(coupon.id, user.userId, b, 200)
            await reserve(coupon.id, other.userId, c, 400)
            await reserve(coupon.id, other.userId, d, 800)
            await uc.commitRedemption.execute(b)
            await uc.commitRedemption.execute(c)
            await uc.releaseRedemption.execute(d)

            expect(await usage(coupon.id)).toEqual({reserved: 1, committed: 2, released: 1, totalDiscount: 700})
        })

        it('keeps usage separate per coupon', async () => {
            const [a, b] = [await createCoupon(admin), await createCoupon(admin)]
            await reserve(a.id, user.userId)

            expect((await usage(a.id)).reserved).toBe(1)
            expect((await usage(b.id)).reserved).toBe(0)
        })

        it('refuses to delete a coupon that was ever redeemed, even if released; deactivate it instead', async () => {
            const coupon = await createCoupon(admin)
            const orderId = randomId()
            await reserve(coupon.id, user.userId, orderId)
            await uc.releaseRedemption.execute(orderId)

            expectError(await admin.delete(`/admin/coupons/${coupon.id}`), 409, 'COUPON_HAS_REDEMPTIONS')
            expect((await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})).statusCode).toBe(200)
            expect((await admin.get(`/admin/coupons/${coupon.id}`)).statusCode).toBe(200)
        })

        it('keeps working after the limit is raised or removed', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            await reserve(coupon.id, user.userId)
            await expect(reserve(coupon.id, other.userId)).rejects.toMatchObject({code: 'COUPON_LIMIT_REACHED'})

            await admin.patch(`/admin/coupons/${coupon.id}`, {usageLimitTotal: 2})
            await expect(reserve(coupon.id, other.userId)).resolves.toBeUndefined()

            await admin.patch(`/admin/coupons/${coupon.id}`, {usageLimitTotal: null})
            await expect(reserve(coupon.id, other.userId)).resolves.toBeUndefined()
        })
    })
})
