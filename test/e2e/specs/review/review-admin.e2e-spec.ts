import {beforeAll, describe, expect, it} from '@jest/globals'

import {IUpsertProductRating} from '@api/product/application'
import {UserRole} from '@api/users/domain'
import {UPSERT_PRODUCT_RATING} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
    UserSession,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    qs,
    randomId,
    sleep,
    walkPages,
} from '../../util/test.util'
import {createCategory, createPublishedProduct} from '../product/product-test.util'
import {listReviews, manyReviews} from './review-test.util'

describe('Reviews: admin (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let anonymous: Api
    let categoryId: string
    let upsertRating: IUpsertProductRating
    let p1: Awaited<ReturnType<typeof createPublishedProduct>>
    let p2: Awaited<ReturnType<typeof createPublishedProduct>>
    let r1: any[]
    let r2: any[]
    let authors1: UserSession[]

    beforeAll(async () => {
        process.env.REVIEW_REQUIRE_PURCHASE = 'false'
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        anonymous = anonymousApi(ctx.app)
        upsertRating = ctx.app.get<IUpsertProductRating>(UPSERT_PRODUCT_RATING, {strict: false})
        categoryId = (await createCategory(admin)).id
        p1 = await createPublishedProduct(ctx.app, admin, {categoryId, variants: [{}]})
        p2 = await createPublishedProduct(ctx.app, admin, {categoryId, variants: [{}]})
        const first = await manyReviews(ctx, p1.id, [5, 4, 3, 5])
        authors1 = first.users
        r1 = first.reviews
        r2 = (await manyReviews(ctx, p2.id, [2, 1])).reviews
        await admin.put(`/admin/reviews/${r1[1].id}/reply`, {text: 'Thank you'})
    })

    const publicRating = async (id: string) => (await anonymous.get(`/products/${id}`)).json().data.meta.rating
    const adminList = async (params: Record<string, any> = {}) => {
        const res = await admin.get(`/admin/reviews${qs({pageSize: 50, ...params})}`)
        expectOk(res, 200, 'REVIEW_ADMIN_LIST_SUCCESS')
        return res.json().data.items as any[]
    }

    describe('GET /admin/reviews', () => {
        it('lists reviews of every product newest first with author and product ids', async () => {
            const items = await adminList()

            expect(items.map((i) => i.id)).toEqual([...[...r2].reverse(), ...[...r1].reverse()].map((r) => r.id))
            expect(items.find((i) => i.id === r1[0].id)).toEqual({
                id: r1[0].id, rating: 5, comment: null, authorName: null, isVerifiedPurchase: false,
                createdAt: expect.any(String), updatedAt: expect.any(String), reply: null,
                productId: p1.id, userId: authors1[0].userId,
            })
        })

        it('shows who replied and when', async () => {
            const replied = (await adminList()).find((i) => i.id === r1[1].id)

            expect(replied.reply).toEqual({text: 'Thank you', repliedAt: expect.any(String), repliedBy: adminSession.userId})
        })

        it('filters by product, rating and whether there is a reply', async () => {
            expect((await adminList({productId: p2.id})).map((i) => i.id)).toEqual([...r2].reverse().map((r) => r.id))
            expect((await adminList({rating: 5})).map((i) => i.id)).toEqual([r1[3].id, r1[0].id])
            expect((await adminList({hasReply: 'true'})).map((i) => i.id)).toEqual([r1[1].id])
            expect((await adminList({hasReply: 'false'})).map((i) => i.id)).not.toContain(r1[1].id)
            expect((await adminList({productId: p1.id, rating: 5, hasReply: 'false'})).map((i) => i.id)).toEqual([r1[3].id, r1[0].id])
        })

        it('walks pages without gaps or duplicates', async () => {
            const full = (await adminList()).map((i) => i.id)

            const pages = await walkPages(admin, '/admin/reviews', {pageSize: 2})

            expect(pages.flatMap((pg) => pg.items.map((i: any) => i.id))).toEqual(full)
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it.each([
            ['hasReply=maybe', {hasReply: 'maybe'}],
            ['rating=6', {rating: 6}],
            ['rating=abc', {rating: 'abc'}],
            ['productId=nope', {productId: 'nope'}],
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=51', {pageSize: 51}],
            ['a cursor over 200 characters', {nextCursor: 'x'.repeat(201)}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await admin.get(`/admin/reviews${qs(params as any)}`))
        })

        it('answers 400 REVIEW_INVALID for a cursor that cannot be decoded', async () => {
            expectError(await admin.get(`/admin/reviews${qs({nextCursor: Buffer.from('x|y').toString('base64url')})}`), 400, 'REVIEW_INVALID')
        })
    })

    describe('PUT /admin/reviews/:id/reply', () => {
        it('answers a review and shows the answer (without the admin id) to everyone', async () => {
            const target = (await manyReviews(ctx, p2.id, [3])).reviews[0]

            const res = await admin.put(`/admin/reviews/${target.id}/reply`, {text: 'We are sorry'})

            expectOk(res, 200, 'REVIEW_REPLY_SUCCESS')
            expect(res.json().data.reply).toEqual({text: 'We are sorry', repliedAt: expect.any(String), repliedBy: adminSession.userId})
            const publicItem = (await listReviews(anonymous, p2.id)).items.find((i) => i.id === target.id)
            expect(publicItem.reply).toEqual({text: 'We are sorry', repliedAt: expect.any(String)})
        })

        it('replaces an existing answer (one reply per review) and normalises Persian letters', async () => {
            const target = (await manyReviews(ctx, p2.id, [4])).reviews[0]
            await admin.put(`/admin/reviews/${target.id}/reply`, {text: 'First'})
            await sleep(10)

            const res = await admin.put(`/admin/reviews/${target.id}/reply`, {text: AR_NAME})

            expect(res.json().data.reply.text).toBe(FA_NAME)
            expect((await adminList({productId: p2.id})).find((i) => i.id === target.id).reply.text).toBe(FA_NAME)
        })

        it('does not change the review itself or the rating', async () => {
            const before = await publicRating(p1.id)

            await admin.put(`/admin/reviews/${r1[2].id}/reply`, {text: 'Noted'})

            const item = (await listReviews(anonymous, p1.id)).items.find((i) => i.id === r1[2].id)
            expect(item).toMatchObject({rating: 3, comment: null})
            expect(await publicRating(p1.id)).toEqual(before)
        })

        it.each([
            ['a missing text', {}],
            ['an empty text', {text: ''}],
            ['a blank text', {text: '   '}],
            ['a text over 1000 characters', {text: 't'.repeat(1001)}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await admin.put(`/admin/reviews/${r1[0].id}/reply`, body))
        })

        it('answers 404 for an unknown review and 400 for a malformed id', async () => {
            expectError(await admin.put(`/admin/reviews/${randomId()}/reply`, {text: 'x'}), 404, 'REVIEW_NOT_FOUND')
            expectValidationError(await admin.put('/admin/reviews/not-a-uuid/reply', {text: 'x'}))
        })
    })

    describe('DELETE /admin/reviews/:id/reply', () => {
        it('removes the answer and answers 404 REVIEW_REPLY_NOT_FOUND when there is none', async () => {
            const target = (await manyReviews(ctx, p2.id, [5])).reviews[0]
            await admin.put(`/admin/reviews/${target.id}/reply`, {text: 'Thanks'})

            const res = await admin.delete(`/admin/reviews/${target.id}/reply`)

            expectOk(res, 200, 'REVIEW_REPLY_DELETE_SUCCESS')
            expect(res.json().data.reply).toBeNull()
            expect((await listReviews(anonymous, p2.id)).items.find((i) => i.id === target.id).reply).toBeNull()
            expectError(await admin.delete(`/admin/reviews/${target.id}/reply`), 404, 'REVIEW_REPLY_NOT_FOUND')
        })

        it('answers 404 for an unknown review and 400 for a malformed id', async () => {
            expectError(await admin.delete(`/admin/reviews/${randomId()}/reply`), 404, 'REVIEW_NOT_FOUND')
            expectValidationError(await admin.delete('/admin/reviews/not-a-uuid/reply'))
        })
    })

    describe('DELETE /admin/reviews/:id', () => {
        it('deletes any review, updates the rating and frees the author to review again', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {categoryId, variants: [{}]})
            const {users, reviews} = await manyReviews(ctx, product.id, [5, 1])
            expect(await publicRating(product.id)).toEqual({average: 3, count: 2})

            const res = await admin.delete(`/admin/reviews/${reviews[1].id}`)

            expectOk(res, 200, 'REVIEW_ADMIN_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            expect(await publicRating(product.id)).toEqual({average: 5, count: 1})
            expect((await listReviews(anonymous, product.id)).items.map((i) => i.id)).toEqual([reviews[0].id])
            expect((await users[1].api.post(`/products/${product.id}/reviews`, {rating: 4})).statusCode).toBe(201)
        })

        it('answers 404 when deleting twice and 400 for a malformed id', async () => {
            const target = (await manyReviews(ctx, p2.id, [2])).reviews[0]
            await admin.delete(`/admin/reviews/${target.id}`)

            expectError(await admin.delete(`/admin/reviews/${target.id}`), 404, 'REVIEW_NOT_FOUND')
            expectValidationError(await admin.delete('/admin/reviews/not-a-uuid'))
        })
    })

    describe('POST /admin/reviews/recalculate-ratings', () => {
        it('repairs ratings that drifted and reports how many products have reviews', async () => {
            const expected = (await adminList()).map((i) => i.productId)
            const products = new Set(expected).size
            await upsertRating.execute({productId: p1.id, average: 1, count: 999}) // simulated drift

            const res = await admin.post('/admin/reviews/recalculate-ratings')

            expectOk(res, 200, 'REVIEW_RECALCULATE_SUCCESS')
            expect(res.json().data).toEqual({products})
            const summary = (await listReviews(anonymous, p1.id)).summary
            expect(await publicRating(p1.id)).toEqual({average: summary.average, count: summary.count})
        })

        it('is idempotent', async () => {
            const first = (await admin.post('/admin/reviews/recalculate-ratings')).json().data
            const before = await publicRating(p1.id)

            const second = (await admin.post('/admin/reviews/recalculate-ratings')).json().data

            expect(second).toEqual(first)
            expect(await publicRating(p1.id)).toEqual(before)
        })
    })

    describe('access control', () => {
        it('is admin only, and writes also need the CSRF header', async () => {
            const shopper = (await createUserSession(ctx)).api
            const noCsrf = apiWithoutCsrf(ctx.app, adminSession.session)
            const calls: ['GET' | 'POST' | 'PUT' | 'DELETE', string, unknown?][] = [
                ['GET', '/admin/reviews'],
                ['PUT', `/admin/reviews/${r1[0].id}/reply`, {text: 'x'}],
                ['DELETE', `/admin/reviews/${r1[0].id}/reply`],
                ['DELETE', `/admin/reviews/${randomId()}`],
                ['POST', '/admin/reviews/recalculate-ratings', {}],
            ]

            for (const [method, url, body] of calls) {
                expect([401, 403]).toContain((await anonymous.request(method, url, body)).statusCode)
                expect((await shopper.request(method, url, body)).statusCode).toBe(403)
                if (method !== 'GET') expect([401, 403]).toContain((await noCsrf.request(method, url, body)).statusCode)
            }
            expect((await listReviews(anonymous, p1.id)).summary.count).toBe(4) // nothing was changed
        })
    })
})
