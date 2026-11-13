import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    anonymousApi,
    Api,
    createSession,
    expectValidationError,
    idsOf,
    qs,
    randomId,
    sleep,
    uid,
    walkPages,
} from '../../../util/test.util'
import {
    createCategory,
    createPublishedProduct,
} from './product-test.util'

const TOTAL = 12

describe('Public catalog: cursor pagination (e2e)', () => {
    let ctx: TestContext
    let anonymous: Api
    const tag = uid()
    const createdIds: string[] = []

    beforeAll(async () => {
        ctx = await testContextE2e()
        const admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        anonymous = anonymousApi(ctx.app)

        const category = await createCategory(admin)
        for (let i = 0; i < TOTAL; i++) {
            const product = await createPublishedProduct(ctx.app, admin, {
                name: `Page ${tag} ${String(i).padStart(2, '0')}`,
                categoryId: category.id,
                // groups of three share the same price so cursors must tie-break on id
                variants: [{price: (Math.floor(i / 3) + 1) * 100, stock: 1}],
            })
            createdIds.push(product.id)
            await sleep(5)
        }
    })

    const fullOrder = async (sort?: string) => {
        const res = await anonymous.get(`/products${qs({pageSize: 100, sort})}`)
        expect(res.statusCode).toBe(200)
        return idsOf(res.json().data.items)
    }

    const encodeCursor = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url')

    it('uses a default page size of 10 and returns a cursor while more results exist', async () => {
        const first = await anonymous.get('/products')

        expect(first.statusCode).toBe(200)
        expect(first.json().data.items).toHaveLength(10)
        expect(typeof first.json().data.nextCursor).toBe('string')

        const second = await anonymous.get(`/products${qs({nextCursor: first.json().data.nextCursor})}`)
        expect(second.json().data.items).toHaveLength(2)
        expect(second.json().data.nextCursor).toBeNull()

        const all = [...idsOf(first.json().data.items), ...idsOf(second.json().data.items)]
        expect(new Set(all).size).toBe(TOTAL)
        expect([...all].sort()).toEqual([...createdIds].sort())
    })

    it('returns everything with pageSize=100 and no cursor', async () => {
        const res = await anonymous.get('/products?pageSize=100')

        expect(res.json().data.items).toHaveLength(TOTAL)
        expect(res.json().data.nextCursor).toBeNull()
    })

    it('returns no cursor when the result exactly fills the page', async () => {
        const res = await anonymous.get(`/products?pageSize=${TOTAL}`)

        expect(res.json().data.items).toHaveLength(TOTAL)
        expect(res.json().data.nextCursor).toBeNull()
    })

    it('walks with pageSize=5 in pages of 5, 5 and 2', async () => {
        const pages = await walkPages(anonymous, '/products', {pageSize: 5})

        expect(pages.map((p) => p.items.length)).toEqual([5, 5, 2])
        expect(pages[2].nextCursor).toBeNull()
    })

    it('walks with pageSize=1 without gaps or duplicates', async () => {
        const pages = await walkPages(anonymous, '/products', {pageSize: 1}, 30)

        expect(pages).toHaveLength(TOTAL)
        const walked = pages.flatMap((p) => idsOf(p.items))
        expect(walked).toEqual(await fullOrder())
    })

    describe.each([
        'createdAt:asc',
        'createdAt:desc',
        'name:asc',
        'name:desc',
        'minPrice:asc',
        'minPrice:desc',
        'maxPrice:asc',
        'maxPrice:desc',
    ])('sort=%s', (sort) => {
        it('yields the same order page by page as in a single page (ties broken by id)', async () => {
            const expected = await fullOrder(sort)
            const pages = await walkPages(anonymous, '/products', {sort, pageSize: 5})

            const walked = pages.flatMap((p) => idsOf(p.items))
            expect(walked).toEqual(expected)
            expect(new Set(walked).size).toBe(TOTAL)
        })
    })

    it('paginates search results the same way', async () => {
        const expected = (
            await anonymous.get(`/products/search${qs({q: `Page ${tag}`, pageSize: 100, sort: 'name:asc'})}`)
        )
            .json()
            .data.items.map((i: any) => i.id)

        const pages = await walkPages(anonymous, '/products/search', {q: `Page ${tag}`, sort: 'name:asc', pageSize: 5})

        expect(expected).toHaveLength(TOTAL)
        expect(pages.flatMap((p) => idsOf(p.items))).toEqual(expected)
    })

    it('returns the first page for a cursor that cannot be decoded', async () => {
        const first = await fullOrder()

        for (const nextCursor of ['not-a-real-cursor', encodeCursor({foo: 'bar'}), encodeCursor({value: 1, id: 2})]) {
            const res = await anonymous.get(`/products${qs({nextCursor, pageSize: 100})}`)

            expect(res.statusCode).toBe(200)
            expect(idsOf(res.json().data.items)).toEqual(first)
        }
    })

    it('never answers with a 5xx for well-formed cursors carrying unusable values', async () => {
        const cursors: [string, string | undefined][] = [
            [encodeCursor({value: 'not-a-date', id: randomId()}), undefined],
            [encodeCursor({value: new Date().toISOString(), id: 'not-a-uuid'}), undefined],
            [encodeCursor({value: 'abc', id: randomId()}), 'minPrice:asc'],
        ]

        for (const [nextCursor, sort] of cursors) {
            const res = await anonymous.get(`/products${qs({nextCursor, sort})}`)

            expect(res.statusCode).toBeLessThan(500)
        }
    })

    it.each([
        ['pageSize=0', {pageSize: 0}],
        ['pageSize=-1', {pageSize: -1}],
        ['pageSize=101', {pageSize: 101}],
        ['pageSize=abc', {pageSize: 'abc'}],
        ['pageSize=1.5', {pageSize: 1.5}],
        ['a cursor over 512 characters', {nextCursor: 'x'.repeat(513)}],
    ])('rejects %s', async (_label, params) => {
        expectValidationError(await anonymous.get(`/products${qs(params as any)}`))
    })
})
