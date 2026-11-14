import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
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
} from '../../../util/test.util'
import {ALL, createDiscount, discountBody, isoFromNow, scope, DAY} from './discount-test.util'

describe('Admin discounts (e2e)', () => {
    let ctx: TestContext
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
    })

    describe('POST /admin/discounts', () => {
        it('creates a discount with defaults', async () => {
            const body = discountBody({kind: 'fixed', value: 5000})

            const res = await admin.post('/admin/discounts', body)

            expectOk(res, 201, 'DISCOUNT_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                name: body.name,
                kind: 'fixed',
                value: 5000,
                maxDiscountPerUnit: null,
                scope: {type: 'all', targetIds: []},
                startsAt: null,
                endsAt: null,
                isActive: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it('stores every field, converting dates to UTC ISO strings', async () => {
            const a = randomId()
            const b = randomId()

            const res = await admin.post(
                '/admin/discounts',
                discountBody({
                    value: 25,
                    maxDiscountPerUnit: 3000,
                    scope: scope('product', a, b, a),
                    startsAt: '2030-01-01T00:00:00+03:30',
                    endsAt: '2030-06-01T12:00:00Z',
                    isActive: false,
                }),
            )

            expect(res.statusCode).toBe(201)
            const data = res.json().data
            expect(data).toMatchObject({
                value: 25,
                maxDiscountPerUnit: 3000,
                startsAt: '2029-12-31T20:30:00.000Z',
                endsAt: '2030-06-01T12:00:00.000Z',
                isActive: false,
            })
            expect(data.scope.type).toBe('product')
            expect([...data.scope.targetIds].sort()).toEqual([a, b].sort())

            const stored = (await admin.get(`/admin/discounts/${data.id}`)).json().data
            expect({...stored, scope: {...stored.scope, targetIds: [...stored.scope.targetIds].sort()}}).toEqual({
                ...data,
                scope: {...data.scope, targetIds: [...data.scope.targetIds].sort()},
            })
        })

        it.each(['category', 'brand', 'product', 'variant'])('accepts the %s scope with targets', async (type) => {
            const id = randomId()

            const res = await admin.post('/admin/discounts', discountBody({scope: scope(type, id)}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data.scope).toEqual({type, targetIds: [id]})
        })

        it('accepts a percent of 100 and a fixed value above 100', async () => {
            expect((await admin.post('/admin/discounts', discountBody({value: 100}))).statusCode).toBe(201)
            expect((await admin.post('/admin/discounts', discountBody({
                kind: 'fixed',
                value: 250
            }))).statusCode).toBe(201)
        })

        it('accepts exactly 500 scope targets', async () => {
            const targetIds = Array.from({length: 500}, () => randomId())

            const res = await admin.post('/admin/discounts', discountBody({scope: scope('variant', ...targetIds)}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data.scope.targetIds).toHaveLength(500)
        })

        it('trims the name and normalises Persian letters', async () => {
            const res = await admin.post('/admin/discounts', discountBody({name: `  ${AR_NAME}  `}))

            expect(res.json().data.name).toBe(FA_NAME)
        })

        const base = () => discountBody()
        const invalidBodies: [string, () => Record<string, unknown>][] = [
            ['a missing name', () => omit(base(), 'name')],
            ['a blank name', () => ({...base(), name: '  '})],
            ['a name over 120 chars', () => ({...base(), name: 'a'.repeat(121)})],
            ['a missing kind', () => omit(base(), 'kind')],
            ['an unknown kind', () => ({...base(), kind: 'bogo'})],
            ['a missing value', () => omit(base(), 'value')],
            ['value 0', () => ({...base(), value: 0})],
            ['a negative value', () => ({...base(), value: -5})],
            ['a fractional value', () => ({...base(), value: 1.5})],
            ['a string value', () => ({...base(), value: '10'})],
            ['a zero cap', () => ({...base(), maxDiscountPerUnit: 0})],
            ['a fractional cap', () => ({...base(), maxDiscountPerUnit: 1.5})],
            ['a missing scope', () => omit(base(), 'scope')],
            ['an unknown scope type', () => ({...base(), scope: scope('shop')})],
            ['a malformed target id', () => ({...base(), scope: {type: 'product', targetIds: ['nope']}})],
            ['more than 500 targets', () => ({
                ...base(),
                scope: scope('variant', ...Array.from({length: 501}, () => randomId()))
            })],
            ['a date without a time', () => ({...base(), startsAt: '2030-01-01'})],
            ['a date without an offset', () => ({...base(), startsAt: '2030-01-01T00:00:00'})],
            ['a non-date startsAt', () => ({...base(), startsAt: 'tomorrow'})],
            ['a numeric endsAt', () => ({...base(), endsAt: 1893456000000})],
            ['a non-boolean isActive', () => ({...base(), isActive: 'yes'})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await admin.post('/admin/discounts', build()))
        })

        it.each([
            ['a percent above 100', {kind: 'percent', value: 101}],
            ['a targeted scope without targets', {scope: scope('product')}],
            ['a start that is not before the end', {startsAt: isoFromNow(DAY), endsAt: isoFromNow(DAY / 2)}],
        ])('rejects %s with DISCOUNT_INVALID', async (_label, overrides) => {
            expectError(await admin.post('/admin/discounts', discountBody(overrides)), 400, 'DISCOUNT_INVALID')
        })

        it('rejects equal start and end', async () => {
            const at = isoFromNow(DAY)

            expectError(await admin.post('/admin/discounts', discountBody({
                startsAt: at,
                endsAt: at
            })), 400, 'DISCOUNT_INVALID')
        })
    })

    describe('GET /admin/discounts/:id', () => {
        it('returns a discount', async () => {
            const discount = await createDiscount(admin)

            const res = await admin.get(`/admin/discounts/${discount.id}`)

            expectOk(res, 200, 'DISCOUNT_GET_SUCCESS')
            expect(res.json().data).toEqual(discount)
        })

        it('returns 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.get(`/admin/discounts/${randomId()}`), 404, 'DISCOUNT_NOT_FOUND')
            expectValidationError(await admin.get('/admin/discounts/not-a-uuid'))
        })
    })

    describe('PATCH /admin/discounts/:id', () => {
        it('updates fields independently', async () => {
            const discount = await createDiscount(admin, {kind: 'percent', value: 10})

            const res = await admin.patch(`/admin/discounts/${discount.id}`, {name: 'Renamed', value: 20})

            expectOk(res, 200, 'DISCOUNT_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject({name: 'Renamed', value: 20, kind: 'percent', scope: ALL})
            expect((await admin.get(`/admin/discounts/${discount.id}`)).json().data.value).toBe(20)
        })

        it('replaces the scope, including going back to "all"', async () => {
            const discount = await createDiscount(admin, {scope: scope('product', randomId())})
            const target = randomId()

            const brand = await admin.patch(`/admin/discounts/${discount.id}`, {scope: scope('brand', target)})
            expect(brand.json().data.scope).toEqual({type: 'brand', targetIds: [target]})

            const all = await admin.patch(`/admin/discounts/${discount.id}`, {scope: {type: 'all'}})
            expect(all.json().data.scope).toEqual({type: 'all', targetIds: []})
            expect((await admin.get(`/admin/discounts/${discount.id}`)).json().data.scope).toEqual(ALL)
        })

        it('clears the cap and the period with null', async () => {
            const discount = await createDiscount(admin, {
                maxDiscountPerUnit: 500,
                startsAt: isoFromNow(-DAY),
                endsAt: isoFromNow(DAY),
            })

            const res = await admin.patch(`/admin/discounts/${discount.id}`, {
                maxDiscountPerUnit: null,
                startsAt: null,
                endsAt: null,
            })

            expect(res.json().data).toMatchObject({maxDiscountPerUnit: null, startsAt: null, endsAt: null})
        })

        it('toggles isActive', async () => {
            const discount = await createDiscount(admin)

            expect((await admin.patch(`/admin/discounts/${discount.id}`, {isActive: false})).json().data.isActive).toBe(false)
            expect((await admin.patch(`/admin/discounts/${discount.id}`, {isActive: true})).json().data.isActive).toBe(true)
        })

        it('validates the merged result and leaves the discount untouched on failure', async () => {
            const fixed = await createDiscount(admin, {kind: 'fixed', value: 500})
            const timed = await createDiscount(admin, {startsAt: isoFromNow(DAY), endsAt: isoFromNow(2 * DAY)})

            expectError(await admin.patch(`/admin/discounts/${fixed.id}`, {kind: 'percent'}), 400, 'DISCOUNT_INVALID')

            expectError(await admin.patch(`/admin/discounts/${timed.id}`, {endsAt: isoFromNow(0)}), 400, 'DISCOUNT_INVALID')
            expectError(await admin.patch(`/admin/discounts/${fixed.id}`, {scope: scope('brand')}), 400, 'DISCOUNT_INVALID')

            expect((await admin.get(`/admin/discounts/${fixed.id}`)).json().data).toEqual(fixed)
            expect((await admin.get(`/admin/discounts/${timed.id}`)).json().data).toEqual(timed)
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const discount = await createDiscount(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/discounts/${discount.id}`, {value: 11})

            expect(res.json().data.createdAt).toBe(discount.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(new Date(discount.updatedAt).getTime())
        })

        it.each([
            ['an empty body', {}],
            ['only unknown fields', {foo: 'bar'}],
            ['a blank name', {name: ' '}],
            ['value 0', {value: 0}],
            ['a zero cap', {maxDiscountPerUnit: 0}],
            ['a malformed date', {startsAt: 'soon'}],
            ['a non-boolean isActive', {isActive: 1}],
        ])('rejects %s', async (_label, body) => {
            const discount = await createDiscount(admin)

            expectValidationError(await admin.patch(`/admin/discounts/${discount.id}`, body))
        })

        it('returns 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.patch(`/admin/discounts/${randomId()}`, {name: 'x'}), 404, 'DISCOUNT_NOT_FOUND')
            expectValidationError(await admin.patch('/admin/discounts/not-a-uuid', {name: 'x'}))
        })
    })

    describe('DELETE /admin/discounts/:id', () => {
        it('deletes a discount', async () => {
            const discount = await createDiscount(admin)

            const res = await admin.delete(`/admin/discounts/${discount.id}`)

            expectOk(res, 200, 'DISCOUNT_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            expectError(await admin.get(`/admin/discounts/${discount.id}`), 404, 'DISCOUNT_NOT_FOUND')
        })

        it('returns 404 when deleting twice and 400 for a malformed id', async () => {
            const discount = await createDiscount(admin)
            await admin.delete(`/admin/discounts/${discount.id}`)

            expectError(await admin.delete(`/admin/discounts/${discount.id}`), 404, 'DISCOUNT_NOT_FOUND')
            expectValidationError(await admin.delete('/admin/discounts/not-a-uuid'))
        })
    })

    describe('GET /admin/discounts', () => {
        const tag = uid()
        const mine = (items: any[]) => items.filter((d) => d.name.startsWith(tag))
        let ids: Record<'alpha' | 'bravo' | 'charlie', string>

        beforeAll(async () => {
            const alpha = await createDiscount(admin, {name: `${tag} Alpha`})
            await sleep(15)
            const bravo = await createDiscount(admin, {name: `${tag} Bravo`, isActive: false})
            await sleep(15)
            const charlie = await createDiscount(admin, {name: `${tag} Charlie`})
            ids = {alpha: alpha.id, bravo: bravo.id, charlie: charlie.id}
        })

        const list = async (params: Record<string, any> = {}) => {
            const res = await admin.get(`/admin/discounts${qs({pageSize: 100, ...params})}`)
            expectOk(res, 200, 'DISCOUNT_LIST_SUCCESS')
            return res.json().data.items as any[]
        }

        it('lists newest first by default with the full discount shape', async () => {
            const items = mine(await list())

            expect(items.map((d) => d.id)).toEqual([ids.charlie, ids.bravo, ids.alpha])
            expect(items[0]).toHaveProperty('scope.targetIds')
            expect(items[0]).toHaveProperty('createdAt')
        })

        it('filters by isActive', async () => {
            expect(mine(await list({isActive: 'true'})).map((d) => d.id)).toEqual([ids.charlie, ids.alpha])
            expect(mine(await list({isActive: 'false'})).map((d) => d.id)).toEqual([ids.bravo])
        })

        it('sorts by name and createdAt', async () => {
            expect(mine(await list({sort: 'name:asc'})).map((d) => d.id)).toEqual([ids.alpha, ids.bravo, ids.charlie])
            expect(mine(await list({sort: 'name:desc'})).map((d) => d.id)).toEqual([ids.charlie, ids.bravo, ids.alpha])
            expect(mine(await list({sort: 'createdAt:asc'})).map((d) => d.id)).toEqual([ids.alpha, ids.bravo, ids.charlie])
        })

        it('ignores unknown sort fields', async () => {
            expect(mine(await list({sort: 'value:asc'})).map((d) => d.id)).toEqual([ids.charlie, ids.bravo, ids.alpha])
        })

        it('walks all pages without gaps or duplicates', async () => {
            const full = (await list({sort: 'name:asc'})).map((d) => d.id)

            const pages = await walkPages(admin, '/admin/discounts', {sort: 'name:asc', pageSize: 2})

            expect(pages.flatMap((p) => p.items.map((d: any) => d.id))).toEqual(full)
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it('ignores a malformed cursor', async () => {
            const res = await admin.get(`/admin/discounts${qs({nextCursor: 'garbage', pageSize: 100})}`)

            expect(res.statusCode).toBe(200)
        })

        it.each([
            ['isActive=maybe', {isActive: 'maybe'}],
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=101', {pageSize: 101}],
            ['pageSize=abc', {pageSize: 'abc'}],
            ['sort=name:up', {sort: 'name:up'}],
            ['a cursor over 512 characters', {nextCursor: 'x'.repeat(513)}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await admin.get(`/admin/discounts${qs(params as any)}`))
        })
    })
})
