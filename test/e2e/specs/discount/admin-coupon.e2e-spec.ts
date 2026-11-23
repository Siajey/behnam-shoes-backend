import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    omit,
    qs,
    randomId,
    sleep,
    uid,
    walkPages,
} from '../../util/test.util'
import {ALL, DAY, couponBody, createCoupon, isoFromNow, scope} from './discount-test.util'

describe('Admin coupons (e2e)', () => {
    let ctx: TestContext
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
    })

    describe('POST /admin/coupons', () => {
        it('creates a coupon with defaults', async () => {
            const body = couponBody({code: `NEW${uid()}`.toUpperCase()})

            const res = await admin.post('/admin/coupons', body)

            expectOk(res, 201, 'COUPON_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                code: body.code,
                name: body.name,
                kind: 'percent',
                value: 10,
                maxDiscount: null,
                minOrderAmount: null,
                scope: ALL,
                applyToDiscountedItems: false,
                startsAt: null,
                endsAt: null,
                usageLimitTotal: null,
                usageLimitPerUser: null,
                isActive: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it('stores every field', async () => {
            const target = randomId()

            const res = await admin.post(
                '/admin/coupons',
                couponBody({
                    kind: 'fixed',
                    value: 50000,
                    maxDiscount: 40000,
                    minOrderAmount: 200000,
                    scope: scope('brand', target),
                    applyToDiscountedItems: true,
                    startsAt: '2030-01-01T00:00:00Z',
                    endsAt: '2030-02-01T00:00:00Z',
                    usageLimitTotal: 100,
                    usageLimitPerUser: 2,
                    isActive: false,
                }),
            )

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({
                kind: 'fixed',
                value: 50000,
                maxDiscount: 40000,
                minOrderAmount: 200000,
                scope: {type: 'brand', targetIds: [target]},
                applyToDiscountedItems: true,
                startsAt: '2030-01-01T00:00:00.000Z',
                endsAt: '2030-02-01T00:00:00.000Z',
                usageLimitTotal: 100,
                usageLimitPerUser: 2,
                isActive: false,
            })
            const stored = (await admin.get(`/admin/coupons/${res.json().data.id}`)).json().data
            expect(stored).toEqual(res.json().data)
        })

        it('normalises the code: trimmed, upper-cased, Persian digits converted', async () => {
            const tag = uid().toUpperCase()

            const lower = await admin.post('/admin/coupons', couponBody({code: `  summer${tag.toLowerCase()} `}))
            expect(lower.json().data.code).toBe(`SUMMER${tag}`)

            const persian = await admin.post('/admin/coupons', couponBody({code: `SALE\u06F2\u06F0${tag}`}))
            expect(persian.json().data.code).toBe(`SALE20${tag}`)
        })

        it('accepts underscores and dashes and codes of 3 and 30 characters', async () => {
            const tag = uid().toUpperCase()

            for (const code of [`A_B-${tag}`, tag.slice(0, 3), 'Z'.repeat(26) + tag.slice(0, 4)]) {
                expect((await admin.post('/admin/coupons', couponBody({code}))).statusCode).toBe(201)
            }
        })

        it('rejects a duplicate code regardless of case', async () => {
            const coupon = await createCoupon(admin)

            expectError(
                await admin.post('/admin/coupons', couponBody({code: coupon.code.toLowerCase()})),
                409,
                'COUPON_CODE_ALREADY_EXISTS',
            )
        })

        it.each(['bad code', 'bad.code', 'caf\u00e9', '\u06A9\u062F\u06A9\u062F'])(
            'rejects the code %p with COUPON_INVALID',
            async (code) => {
                expectError(await admin.post('/admin/coupons', couponBody({code})), 400, 'COUPON_INVALID')
            },
        )

        const base = () => couponBody()
        const invalidBodies: [string, () => Record<string, unknown>][] = [
            ['a missing code', () => omit(base(), 'code')],
            ['a code under 3 characters', () => ({...base(), code: 'AB'})],
            ['a code over 30 characters', () => ({...base(), code: 'A'.repeat(31)})],
            ['a missing name', () => omit(base(), 'name')],
            ['an unknown kind', () => ({...base(), kind: 'bogo'})],
            ['value 0', () => ({...base(), value: 0})],
            ['a fractional value', () => ({...base(), value: 2.5})],
            ['a zero maxDiscount', () => ({...base(), maxDiscount: 0})],
            ['a zero minOrderAmount', () => ({...base(), minOrderAmount: 0})],
            ['a zero total usage limit', () => ({...base(), usageLimitTotal: 0})],
            ['a zero per-user limit', () => ({...base(), usageLimitPerUser: 0})],
            ['a fractional limit', () => ({...base(), usageLimitTotal: 1.5})],
            ['a malformed target id', () => ({...base(), scope: {type: 'product', targetIds: ['nope']}})],
            ['a date without an offset', () => ({...base(), endsAt: '2030-01-01T00:00:00'})],
            ['a non-boolean applyToDiscountedItems', () => ({...base(), applyToDiscountedItems: 'yes'})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await admin.post('/admin/coupons', build()))
        })

        it.each([
            ['a percent above 100', {value: 101}],
            ['a targeted scope without targets', {scope: scope('category')}],
            ['an end before the start', {startsAt: isoFromNow(2 * DAY), endsAt: isoFromNow(DAY)}],
        ])('rejects %s with COUPON_INVALID', async (_label, overrides) => {
            expectError(await admin.post('/admin/coupons', couponBody(overrides)), 400, 'COUPON_INVALID')
        })
    })

    describe('GET /admin/coupons/:id', () => {
        it('returns a coupon', async () => {
            const coupon = await createCoupon(admin)

            const res = await admin.get(`/admin/coupons/${coupon.id}`)

            expectOk(res, 200, 'COUPON_GET_SUCCESS')
            expect(res.json().data).toEqual(coupon)
        })

        it('returns 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.get(`/admin/coupons/${randomId()}`), 404, 'COUPON_NOT_FOUND')
            expectValidationError(await admin.get('/admin/coupons/not-a-uuid'))
        })
    })

    describe('PATCH /admin/coupons/:id', () => {
        it('updates fields independently and keeps the code', async () => {
            const coupon = await createCoupon(admin)

            const res = await admin.patch(`/admin/coupons/${coupon.id}`, {
                name: 'Renamed',
                value: 15,
                minOrderAmount: 5000,
                usageLimitTotal: 10,
                applyToDiscountedItems: true,
            })

            expectOk(res, 200, 'COUPON_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject({
                code: coupon.code,
                name: 'Renamed',
                value: 15,
                minOrderAmount: 5000,
                usageLimitTotal: 10,
                applyToDiscountedItems: true,
            })
        })

        it('ignores an attempt to change the code', async () => {
            const coupon = await createCoupon(admin)

            const res = await admin.patch(`/admin/coupons/${coupon.id}`, {code: 'OTHERCODE', name: 'Renamed'})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.code).toBe(coupon.code)
            expectValidationError(await admin.patch(`/admin/coupons/${coupon.id}`, {code: 'OTHERCODE'}))
        })

        it('clears optional fields with null', async () => {
            const coupon = await createCoupon(admin, {
                maxDiscount: 100,
                minOrderAmount: 100,
                usageLimitTotal: 5,
                usageLimitPerUser: 1,
                startsAt: isoFromNow(-DAY),
                endsAt: isoFromNow(DAY),
            })

            const res = await admin.patch(`/admin/coupons/${coupon.id}`, {
                maxDiscount: null,
                minOrderAmount: null,
                usageLimitTotal: null,
                usageLimitPerUser: null,
                startsAt: null,
                endsAt: null,
            })

            expect(res.json().data).toMatchObject({
                maxDiscount: null,
                minOrderAmount: null,
                usageLimitTotal: null,
                usageLimitPerUser: null,
                startsAt: null,
                endsAt: null,
            })
        })

        it('replaces the scope and toggles isActive', async () => {
            const coupon = await createCoupon(admin)
            const target = randomId()

            const res = await admin.patch(`/admin/coupons/${coupon.id}`, {scope: scope('variant', target), isActive: false})

            expect(res.json().data).toMatchObject({scope: {type: 'variant', targetIds: [target]}, isActive: false})
        })

        it('validates the merged result and leaves the coupon untouched on failure', async () => {
            const coupon = await createCoupon(admin, {kind: 'fixed', value: 500})

            expectError(await admin.patch(`/admin/coupons/${coupon.id}`, {kind: 'percent'}), 400, 'COUPON_INVALID')
            expectError(
                await admin.patch(`/admin/coupons/${coupon.id}`, {startsAt: isoFromNow(DAY), endsAt: isoFromNow(0)}),
                400,
                'COUPON_INVALID',
            )

            expect((await admin.get(`/admin/coupons/${coupon.id}`)).json().data).toEqual(coupon)
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const coupon = await createCoupon(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/coupons/${coupon.id}`, {value: 11})

            expect(res.json().data.createdAt).toBe(coupon.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(new Date(coupon.updatedAt).getTime())
        })

        it.each([
            ['an empty body', {}],
            ['a blank name', {name: ' '}],
            ['value 0', {value: 0}],
            ['a zero limit', {usageLimitPerUser: 0}],
            ['a malformed date', {endsAt: 'soon'}],
        ])('rejects %s', async (_label, body) => {
            const coupon = await createCoupon(admin)

            expectValidationError(await admin.patch(`/admin/coupons/${coupon.id}`, body))
        })

        it('returns 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.patch(`/admin/coupons/${randomId()}`, {name: 'x'}), 404, 'COUPON_NOT_FOUND')
            expectValidationError(await admin.patch('/admin/coupons/not-a-uuid', {name: 'x'}))
        })
    })

    describe('DELETE /admin/coupons/:id', () => {
        it('deletes a coupon that was never redeemed and frees its code', async () => {
            const coupon = await createCoupon(admin)

            const res = await admin.delete(`/admin/coupons/${coupon.id}`)

            expectOk(res, 200, 'COUPON_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            expectError(await admin.get(`/admin/coupons/${coupon.id}`), 404, 'COUPON_NOT_FOUND')
            expect((await admin.post('/admin/coupons', couponBody({code: coupon.code}))).statusCode).toBe(201)
        })

        it('returns 404 when deleting twice and 400 for a malformed id', async () => {
            const coupon = await createCoupon(admin)
            await admin.delete(`/admin/coupons/${coupon.id}`)

            expectError(await admin.delete(`/admin/coupons/${coupon.id}`), 404, 'COUPON_NOT_FOUND')
            expectValidationError(await admin.delete('/admin/coupons/not-a-uuid'))
        })
    })

    describe('GET /admin/coupons/:id/usage', () => {
        it('returns zeros for a coupon nobody used', async () => {
            const coupon = await createCoupon(admin)

            const res = await admin.get(`/admin/coupons/${coupon.id}/usage`)

            expectOk(res, 200, 'COUPON_USAGE_SUCCESS')
            expect(res.json().data).toEqual({reserved: 0, committed: 0, released: 0, totalDiscount: 0})
        })

        it('returns 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.get(`/admin/coupons/${randomId()}/usage`), 404, 'COUPON_NOT_FOUND')
            expectValidationError(await admin.get('/admin/coupons/not-a-uuid/usage'))
        })
    })

    describe('GET /admin/coupons', () => {
        const tag = uid().toUpperCase()
        const mine = (items: any[]) => items.filter((c) => c.code.startsWith(`L${tag}`))
        let ids: Record<'a' | 'b' | 'c', string>

        beforeAll(async () => {
            const a = await createCoupon(admin, {code: `L${tag}A`})
            await sleep(15)
            const b = await createCoupon(admin, {code: `L${tag}B`, isActive: false})
            await sleep(15)
            const c = await createCoupon(admin, {code: `L${tag}C`})
            ids = {a: a.id, b: b.id, c: c.id}
        })

        const list = async (params: Record<string, any> = {}) => {
            const res = await admin.get(`/admin/coupons${qs({pageSize: 100, ...params})}`)
            expectOk(res, 200, 'COUPON_LIST_SUCCESS')
            return res.json().data.items as any[]
        }

        it('lists newest first by default', async () => {
            expect(mine(await list()).map((c) => c.id)).toEqual([ids.c, ids.b, ids.a])
        })

        it('filters by isActive', async () => {
            expect(mine(await list({isActive: 'true'})).map((c) => c.id)).toEqual([ids.c, ids.a])
            expect(mine(await list({isActive: 'false'})).map((c) => c.id)).toEqual([ids.b])
        })

        it('sorts by code and createdAt', async () => {
            expect(mine(await list({sort: 'code:asc'})).map((c) => c.id)).toEqual([ids.a, ids.b, ids.c])
            expect(mine(await list({sort: 'code:desc'})).map((c) => c.id)).toEqual([ids.c, ids.b, ids.a])
            expect(mine(await list({sort: 'createdAt:asc'})).map((c) => c.id)).toEqual([ids.a, ids.b, ids.c])
        })

        it('walks all pages without gaps or duplicates', async () => {
            const full = (await list({sort: 'code:asc'})).map((c) => c.id)

            const pages = await walkPages(admin, '/admin/coupons', {sort: 'code:asc', pageSize: 2})

            expect(pages.flatMap((p) => p.items.map((c: any) => c.id))).toEqual(full)
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it.each([
            ['isActive=maybe', {isActive: 'maybe'}],
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=101', {pageSize: 101}],
            ['sort=code:up', {sort: 'code:up'}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await admin.get(`/admin/coupons${qs(params as any)}`))
        })
    })
})
