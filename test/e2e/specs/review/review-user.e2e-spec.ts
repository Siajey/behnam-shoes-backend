import {afterAll, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
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
import {createCategory, createDraftProduct, createPublishedProduct, unpublishProduct} from '../product/product-test.util'
import {ensureShippingMethods} from '../shipping/shipping-test.util'
import {OrderState, buyer, listReviews, manyReviews, postReview, reviewOk, reviewUrl, withReviewPolicy} from './review-test.util'

describe('Reviews: shoppers (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    let categoryId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        anonymous = anonymousApi(ctx.app)
        await ensureShippingMethods(admin)
        categoryId = (await createCategory(admin)).id
    })

    const product = () => createPublishedProduct(ctx.app, admin, {categoryId, variants: [{price: 1000, stock: 100000}]})
    const ratingOf = async (productId: string) => (await anonymous.get(`/products/${productId}`)).json().data.meta.rating

    describe('POST /products/:productId/reviews (purchase required, the default)', () => {
        it('lets a buyer review, flags it as a verified purchase and returns the public shape', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])

            const res = await postReview(user.api, p.id, {rating: 4, comment: 'Very good', displayName: 'Sara'})

            expectOk(res, 201, 'REVIEW_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                rating: 4,
                comment: 'Very good',
                authorName: 'Sara',
                isVerifiedPurchase: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                reply: null,
            })
            expect(res.json().data).not.toHaveProperty('userId')
        })

        it('needs only a rating: comment and name default to null', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])

            const review = await reviewOk(user.api, p.id, {rating: 3})

            expect(review).toMatchObject({rating: 3, comment: null, authorName: null})
        })

        it.each(['shipped', 'delivered'] as OrderState[])('accepts a buyer whose order is %s', async (state) => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0], state)

            expect((await postReview(user.api, p.id)).statusCode).toBe(201)
        })

        it.each(['pending_payment', 'paid', 'processing', 'cancelled'] as OrderState[])(
            'refuses a user whose order is only %s',
            async (state) => {
                const p = await product()
                const user = await buyer(ctx, admin, p.variantIds[0], state)

                expectError(await postReview(user.api, p.id), 403, 'REVIEW_PURCHASE_REQUIRED')
            },
        )

        it('refuses a user who never bought, and one who bought a different product', async () => {
            const [p, other] = [await product(), await product()]
            const stranger = await createUserSession(ctx)
            const ofOther = await buyer(ctx, admin, other.variantIds[0])

            expectError(await postReview(stranger.api, p.id), 403, 'REVIEW_PURCHASE_REQUIRED')
            expectError(await postReview(ofOther.api, p.id), 403, 'REVIEW_PURCHASE_REQUIRED')
            expect((await listReviews(anonymous, p.id)).summary.count).toBe(0)
        })

        it('answers 409 for a second review of the same product, but allows other products', async () => {
            const [p, other] = [await product(), await product()]
            const user = await buyer(ctx, admin, p.variantIds[0])
            await reviewOk(user.api, p.id)

            expectError(await postReview(user.api, p.id, {rating: 1}), 409, 'REVIEW_ALREADY_EXISTS')
            expect((await listReviews(anonymous, p.id)).summary.count).toBe(1)
            expectError(await postReview(user.api, other.id), 403, 'REVIEW_PURCHASE_REQUIRED') // another product: needs its own purchase
        })

        it('lets only one of two parallel submissions through', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])

            const results = await Promise.all([postReview(user.api, p.id), postReview(user.api, p.id)])

            expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409])
            expect((await listReviews(anonymous, p.id)).summary.count).toBe(1)
        })

        it('answers 404 REVIEW_PRODUCT_NOT_FOUND for unknown, draft and unpublished products', async () => {
            const user = await createUserSession(ctx)
            const unpublished = await product()
            await unpublishProduct(admin, unpublished.id)
            const draft = await createDraftProduct(ctx.app, admin, [{}])

            for (const id of [randomId(), unpublished.id, draft.id]) {
                expectError(await postReview(user.api, id), 404, 'REVIEW_PRODUCT_NOT_FOUND')
            }
            expectValidationError(await postReview(user.api, 'not-a-uuid'))
        })

        it('needs a session and the CSRF header', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])

            expect([401, 403]).toContain((await postReview(anonymous, p.id)).statusCode)
            expect([401, 403]).toContain((await postReview(apiWithoutCsrf(ctx.app, user.session), p.id)).statusCode)
            expect((await listReviews(anonymous, p.id)).summary.count).toBe(0)
        })
    })

    describe('POST body validation and cleaning', () => {
        let p: Awaited<ReturnType<typeof product>>
        beforeAll(async () => {
            p = await product()
        })

        const invalid = async (body: Record<string, unknown>) => {
            let result: Awaited<ReturnType<typeof postReview>> | undefined
            await withReviewPolicy('false', async () => {
                result = await postReview((await createUserSession(ctx)).api, p.id, body)
            })
            expectValidationError(result!)
        }

        it.each([
            ['a missing rating', {}],
            ['rating 0', {rating: 0}],
            ['rating 6', {rating: 6}],
            ['a fractional rating', {rating: 4.5}],
            ['a string rating', {rating: '5'}],
            ['a null rating', {rating: null}],
            ['an empty comment', {rating: 5, comment: ''}],
            ['a blank comment', {rating: 5, comment: '   '}],
            ['a comment over 2000 characters', {rating: 5, comment: 'c'.repeat(2001)}],
            ['an empty displayName', {rating: 5, displayName: ''}],
            ['a displayName over 40 characters', {rating: 5, displayName: 'n'.repeat(41)}],
        ])('rejects %s', async (_label, body) => {
            await invalid(body)
        })

        it.each([1, 2, 3, 4, 5])('accepts rating %d', async (rating) => {
            await withReviewPolicy('false', async () => {
                expect((await postReview((await createUserSession(ctx)).api, p.id, {rating})).statusCode).toBe(201)
            })
        })

        it('accepts the maximum lengths and trims whitespace', async () => {
            await withReviewPolicy('false', async () => {
                const res = await postReview((await createUserSession(ctx)).api, p.id, {
                    rating: 5, comment: `  ${'c'.repeat(2000)}  `, displayName: ` ${'n'.repeat(40)} `,
                })

                expect(res.statusCode).toBe(201)
                expect(res.json().data.comment).toHaveLength(2000)
                expect(res.json().data.authorName).toHaveLength(40)
            })
        })

        it('normalises Arabic kaf/yeh to the Persian letters', async () => {
            await withReviewPolicy('false', async () => {
                const review = await reviewOk((await createUserSession(ctx)).api, p.id, {rating: 5, comment: AR_NAME, displayName: AR_NAME})

                expect(review).toMatchObject({comment: FA_NAME, authorName: FA_NAME})
            })
        })
    })

    describe('with the purchase rule switched off (REVIEW_REQUIRE_PURCHASE=false)', () => {
        beforeAll(() => {
            process.env.REVIEW_REQUIRE_PURCHASE = 'false'
        })
        afterAll(() => {
            delete process.env.REVIEW_REQUIRE_PURCHASE
        })

        it('lets anyone review, flagging only real buyers as verified', async () => {
            const p = await product()
            const stranger = await createUserSession(ctx)
            const real = await buyer(ctx, admin, p.variantIds[0])

            expect((await reviewOk(stranger.api, p.id)).isVerifiedPurchase).toBe(false)
            expect((await reviewOk(real.api, p.id)).isVerifiedPurchase).toBe(true)
        })

        it('does not count unshipped orders as a purchase', async () => {
            const p = await product()
            const paidOnly = await buyer(ctx, admin, p.variantIds[0], 'paid')

            expect((await reviewOk(paidOnly.api, p.id)).isVerifiedPurchase).toBe(false)
        })

        it('still refuses a missing product and a duplicate', async () => {
            const p = await product()
            const user = await createUserSession(ctx)
            await reviewOk(user.api, p.id)

            expectError(await postReview(user.api, p.id), 409, 'REVIEW_ALREADY_EXISTS')
            expectError(await postReview(user.api, randomId()), 404, 'REVIEW_PRODUCT_NOT_FOUND')
        })
    })

    describe('GET /products/:productId/reviews (public)', () => {
        beforeAll(() => {
            process.env.REVIEW_REQUIRE_PURCHASE = 'false'
        })
        afterAll(() => {
            delete process.env.REVIEW_REQUIRE_PURCHASE
        })

        it('is empty and zeroed for a product without reviews', async () => {
            const p = await product()

            expect(await listReviews(anonymous, p.id)).toEqual({
                summary: {average: 0, count: 0, distribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}},
                items: [],
                nextCursor: null,
            })
        })

        it('summarises ratings (average to one decimal and the distribution) and lists newest first', async () => {
            const p = await product()
            const {reviews} = await manyReviews(ctx, p.id, [5, 5, 4, 3, 1])

            const data = await listReviews(anonymous, p.id)

            expect(data.summary).toEqual({average: 3.6, count: 5, distribution: {1: 1, 2: 0, 3: 1, 4: 1, 5: 2}})
            expect(data.items.map((i) => i.id)).toEqual([...reviews].reverse().map((r) => r.id))
        })

        it.each([
            [[5, 4, 4], 4.3],
            [[5, 5, 4], 4.7],
            [[1, 2], 1.5],
            [[5], 5],
        ])('rounds the average of %j to %d', async (ratings, average) => {
            const p = await product()
            await manyReviews(ctx, p.id, ratings)

            expect((await listReviews(anonymous, p.id)).summary.average).toBe(average)
        })

        it('filters the items by rating but keeps the summary of all reviews', async () => {
            const p = await product()
            await manyReviews(ctx, p.id, [5, 4, 5, 2])

            const data = await listReviews(anonymous, p.id, '?rating=5')

            expect(data.items.map((i) => i.rating)).toEqual([5, 5])
            expect(data.summary.count).toBe(4)
        })

        it('paginates with a cursor (default 20, up to 50) without gaps or duplicates', async () => {
            const p = await product()
            const {reviews} = await manyReviews(ctx, p.id, Array.from({length: 23}, (_, i) => (i % 5) + 1))

            const first = await listReviews(anonymous, p.id)
            expect(first.items).toHaveLength(20)
            expect(first.nextCursor).toEqual(expect.any(String))
            expect((await listReviews(anonymous, p.id, '?pageSize=50')).items).toHaveLength(23)

            const pages = await walkPages(anonymous, reviewUrl(p.id), {pageSize: 5})
            expect(pages.flatMap((pg) => pg.items.map((i: any) => i.id))).toEqual([...reviews].reverse().map((r) => r.id))
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it('returns no cursor when the last page is exactly full', async () => {
            const p = await product()
            await manyReviews(ctx, p.id, [5, 5])

            expect((await listReviews(anonymous, p.id, '?pageSize=2')).nextCursor).toBeNull()
        })

        it('answers 400 REVIEW_INVALID for a cursor that cannot be decoded', async () => {
            const p = await product()
            const garbage = Buffer.from('not|a-uuid').toString('base64url')

            expectError(await anonymous.get(`${reviewUrl(p.id)}${qs({nextCursor: garbage})}`), 400, 'REVIEW_INVALID')
        })

        it.each([
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=51', {pageSize: 51}],
            ['pageSize=abc', {pageSize: 'abc'}],
            ['rating=0', {rating: 0}],
            ['rating=6', {rating: 6}],
            ['rating=abc', {rating: 'abc'}],
            ['a cursor over 200 characters', {nextCursor: 'x'.repeat(201)}],
        ])('rejects %s', async (_label, params) => {
            const p = await product()

            expectValidationError(await anonymous.get(`${reviewUrl(p.id)}${qs(params as any)}`))
        })

        it('answers 404 for unknown, draft and unpublished products and 400 for a malformed id', async () => {
            const unpublished = await product()
            await unpublishProduct(admin, unpublished.id)
            const draft = await createDraftProduct(ctx.app, admin, [{}])

            for (const id of [randomId(), unpublished.id, draft.id]) {
                expectError(await anonymous.get(reviewUrl(id)), 404, 'REVIEW_PRODUCT_NOT_FOUND')
            }
            expectValidationError(await anonymous.get(reviewUrl('not-a-uuid')))
        })
    })

    describe('GET /products/:productId/reviews/me', () => {
        const me = async (api: Api, productId: string) => {
            const res = await api.get(`${reviewUrl(productId)}/me`)
            expectOk(res, 200, 'REVIEW_ME_SUCCESS')
            return res.json().data
        }

        it('says a buyer can review, a non-buyer cannot, and returns their own review once written', async () => {
            const p = await product()
            const real = await buyer(ctx, admin, p.variantIds[0])
            const stranger = await createUserSession(ctx)
            expect(await me(real.api, p.id)).toEqual({canReview: true, review: null})
            expect(await me(stranger.api, p.id)).toEqual({canReview: false, review: null})

            const written = await reviewOk(real.api, p.id, {rating: 4, comment: 'Nice'})

            expect(await me(real.api, p.id)).toEqual({canReview: false, review: written})
        })

        it('lets everyone review when the purchase rule is off', async () => {
            const p = await product()
            const stranger = await createUserSession(ctx)

            await withReviewPolicy('false', async () => {
                expect(await me(stranger.api, p.id)).toEqual({canReview: true, review: null})
            })
        })

        it('needs a session (but no CSRF) and answers 404 for a missing product', async () => {
            const p = await product()
            const user = await createUserSession(ctx)

            expect([401, 403]).toContain((await anonymous.get(`${reviewUrl(p.id)}/me`)).statusCode)
            expect((await apiWithoutCsrf(ctx.app, user.session).get(`${reviewUrl(p.id)}/me`)).statusCode).toBe(200)
            expectError(await user.api.get(`${reviewUrl(randomId())}/me`), 404, 'REVIEW_PRODUCT_NOT_FOUND')
        })
    })

    describe('PATCH /reviews/:id', () => {
        const mine = async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])
            const review = await reviewOk(user.api, p.id, {rating: 3, comment: 'Ok', displayName: 'Sara'})
            return {p, user, review}
        }

        it('changes the fields independently and advances updatedAt', async () => {
            const {user, review} = await mine()
            await sleep(10)

            const res = await user.api.patch(`/reviews/${review.id}`, {rating: 5, comment: 'Great'})

            expectOk(res, 200, 'REVIEW_EDIT_SUCCESS')
            expect(res.json().data).toMatchObject({id: review.id, rating: 5, comment: 'Great', authorName: 'Sara', createdAt: review.createdAt})
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(new Date(review.updatedAt).getTime())
        })

        it('clears the comment and the name with null', async () => {
            const {user, review} = await mine()

            const res = await user.api.patch(`/reviews/${review.id}`, {comment: null, displayName: null})

            expect(res.json().data).toMatchObject({comment: null, authorName: null, rating: 3})
        })

        it('keeps the admin reply', async () => {
            const {user, review} = await mine()
            await admin.put(`/admin/reviews/${review.id}/reply`, {text: 'Thanks!'})

            const res = await user.api.patch(`/reviews/${review.id}`, {comment: 'Edited'})

            expect(res.json().data.reply).toMatchObject({text: 'Thanks!'})
        })

        it('updates the product rating when the rating changes', async () => {
            const {p, user, review} = await mine()
            expect(await ratingOf(p.id)).toEqual({average: 3, count: 1})

            await user.api.patch(`/reviews/${review.id}`, {rating: 5})

            expect(await ratingOf(p.id)).toEqual({average: 5, count: 1})
            expect((await listReviews(anonymous, p.id)).summary.distribution).toMatchObject({3: 0, 5: 1})
        })

        it('answers 404 for someone else\'s review and for an unknown one', async () => {
            const {review} = await mine()
            const stranger = await createUserSession(ctx)

            expectError(await stranger.api.patch(`/reviews/${review.id}`, {rating: 1}), 404, 'REVIEW_NOT_FOUND')
            expectError(await stranger.api.patch(`/reviews/${randomId()}`, {rating: 1}), 404, 'REVIEW_NOT_FOUND')
        })

        it.each([
            ['an empty body', {}],
            ['rating 0', {rating: 0}],
            ['rating 6', {rating: 6}],
            ['an empty comment', {comment: ''}],
            ['a comment over 2000 characters', {comment: 'c'.repeat(2001)}],
            ['a name over 40 characters', {displayName: 'n'.repeat(41)}],
        ])('rejects %s', async (_label, body) => {
            const {user, review} = await mine()

            expectValidationError(await user.api.patch(`/reviews/${review.id}`, body))
        })

        it('needs a session and the CSRF header, and rejects a malformed id', async () => {
            const {user, review} = await mine()

            expect([401, 403]).toContain((await anonymous.patch(`/reviews/${review.id}`, {rating: 1})).statusCode)
            expect([401, 403]).toContain((await apiWithoutCsrf(ctx.app, user.session).patch(`/reviews/${review.id}`, {rating: 1})).statusCode)
            expectValidationError(await user.api.patch('/reviews/not-a-uuid', {rating: 1}))
        })
    })

    describe('DELETE /reviews/:id', () => {
        it('removes the review, updates the product rating and allows writing a new one', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])
            const review = await reviewOk(user.api, p.id, {rating: 2})
            expect(await ratingOf(p.id)).toEqual({average: 2, count: 1})

            const res = await user.api.delete(`/reviews/${review.id}`)

            expectOk(res, 200, 'REVIEW_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            expect((await listReviews(anonymous, p.id)).items).toEqual([])
            expect(await ratingOf(p.id)).toEqual({average: 0, count: 0})
            expect((await postReview(user.api, p.id, {rating: 5})).statusCode).toBe(201)
        })

        it('answers 404 for someone else\'s review and when deleting twice', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])
            const review = await reviewOk(user.api, p.id)
            const stranger = await createUserSession(ctx)

            expectError(await stranger.api.delete(`/reviews/${review.id}`), 404, 'REVIEW_NOT_FOUND')
            expect((await listReviews(anonymous, p.id)).summary.count).toBe(1)
            await user.api.delete(`/reviews/${review.id}`)
            expectError(await user.api.delete(`/reviews/${review.id}`), 404, 'REVIEW_NOT_FOUND')
        })

        it('needs a session and the CSRF header', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0])
            const review = await reviewOk(user.api, p.id)

            expect([401, 403]).toContain((await anonymous.delete(`/reviews/${review.id}`)).statusCode)
            expect([401, 403]).toContain((await apiWithoutCsrf(ctx.app, user.session).delete(`/reviews/${review.id}`)).statusCode)
            expectValidationError(await user.api.delete('/reviews/not-a-uuid'))
        })
    })

    describe('the rating on the product', () => {
        it('follows every create, edit and delete with an average of one decimal and the count', async () => {
            const p = await product()
            await withReviewPolicy('false', async () => {
                expect(await ratingOf(p.id)).toEqual({average: 0, count: 0})

                const {users, reviews} = await manyReviews(ctx, p.id, [5, 4, 4])
                expect(await ratingOf(p.id)).toEqual({average: 4.3, count: 3})

                await users[0].api.patch(`/reviews/${reviews[0].id}`, {rating: 1})
                expect(await ratingOf(p.id)).toEqual({average: 3, count: 3})

                await users[1].api.delete(`/reviews/${reviews[1].id}`)
                await users[2].api.delete(`/reviews/${reviews[2].id}`)
                expect(await ratingOf(p.id)).toEqual({average: 1, count: 1})
            })
        })

        it('is kept per product', async () => {
            const [a, b] = [await product(), await product()]
            await withReviewPolicy('false', async () => {
                await manyReviews(ctx, a.id, [5])
                await manyReviews(ctx, b.id, [1, 2])
            })

            expect(await ratingOf(a.id)).toEqual({average: 5, count: 1})
            expect(await ratingOf(b.id)).toEqual({average: 1.5, count: 2})
        })

        it('is not changed by a rejected review', async () => {
            const p = await product()
            const stranger = await createUserSession(ctx)

            await postReview(stranger.api, p.id, {rating: 1}) // 403: no purchase

            expect(await ratingOf(p.id)).toEqual({average: 0, count: 0})
        })

        it('shows in the product list and in search as well', async () => {
            const p = await createPublishedProduct(ctx.app, admin, {categoryId, name: `Rated item ${randomId().slice(0, 8)}`, variants: [{}]})
            await withReviewPolicy('false', async () => {
                await manyReviews(ctx, p.id, [4, 5])
            })

            const listed = (await anonymous.get('/products?pageSize=100')).json().data.items.find((i: any) => i.id === p.id)
            const found = (await anonymous.get(`/products/search${qs({q: p.name})}`)).json().data.items[0]

            expect(listed.meta.rating).toEqual({average: 4.5, count: 2})
            expect(found.meta.rating).toEqual({average: 4.5, count: 2})
        })
    })
})
