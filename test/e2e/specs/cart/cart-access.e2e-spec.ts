import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    anonymousApi,
    Api,
    apiWithoutCsrf,
    createUserSession, Method,
    randomId,
    UserSession,
} from '../../../util/test.util'
import {
    createPublishedProduct,
} from '../product/product-test.util'
import {
    getCart,
    putInCart,
} from './cart-test.util'

const REJECTED = [401, 403]

describe('Cart: access control (e2e)', () => {
    let ctx: TestContext
    let user: UserSession
    let anonymous: Api
    let withoutCsrf: Api
    let variantId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        anonymous = anonymousApi(ctx.app)
        user = await createUserSession(ctx)
        withoutCsrf = apiWithoutCsrf(ctx.app, user.session)

        const admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        const product = await createPublishedProduct(ctx.app, admin, {variants: [{stock: 9}]})
        variantId = product.variantIds[0]
    })

    type Route = {
        label: string
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
        url: () => string
        body?: () => unknown
    }

    const routes: Route[] = [
        {label: 'GET /cart', method: 'GET', url: () => '/cart'},
        {
            label: 'POST /cart/items',
            method: 'POST',
            url: () => '/cart/items',
            body: () => ({variantId, quantity: 1}),
        },
        {
            label: 'PATCH /cart/items/:variantId',
            method: 'PATCH',
            url: () => `/cart/items/${variantId}`,
            body: () => ({quantity: 2}),
        },
        {
            label: 'DELETE /cart/items/:variantId',
            method: 'DELETE',
            url: () => `/cart/items/${variantId}`,
        },
        {label: 'DELETE /cart', method: 'DELETE', url: () => '/cart'},
        {
            label: 'POST /cart/merge',
            method: 'POST',
            url: () => '/cart/merge',
            body: () => ({items: [{variantId, quantity: 1}]}),
        },
    ]

    const mutating = routes.filter(({method}) => method !== 'GET')

    describe('without a session', () => {
        it.each(routes)('$label is rejected', async ({method, url, body}) => {
            const res = await anonymous.request(method, url(), body?.())

            expect(REJECTED).toContain(res.statusCode)
        })

        it('does not leak cart data in the rejection', async () => {
            const res = await anonymous.get('/cart')

            expect(res.json().data?.items).toBeUndefined()
        })
    })

    describe('with a session but without the CSRF header', () => {
        it.each(mutating)('%s is rejected', async ({method, url, body}) => {
            const res = await withoutCsrf.request(method, url(), body?.())

            expect(REJECTED).toContain(res.statusCode)
        })

        it('does not apply the change that was rejected', async () => {
            const fresh = await createUserSession(ctx)

            await apiWithoutCsrf(ctx.app, fresh.session).post('/cart/items', {variantId, quantity: 1})

            expect((await getCart(fresh.api)).items).toEqual([])
        })
    })

    describe('with a wrong CSRF token', () => {
        it.each(mutating)('%s is rejected', async ({ method, url, body }) => {
            const res = await ctx.app.inject({
                method,
                url: url(),
                cookies: user.session.cookies,
                headers: {'x-csrf-token': 'x'.repeat(64)},
                payload: (body?.() ?? undefined) as any,
            })

            expect(REJECTED).toContain(res.statusCode)
        })

        it('rejects a token that belongs to another user\'s session', async () => {
            const other = await createUserSession(ctx)

            const res = await ctx.app.inject({
                method: 'POST',
                url: '/cart/items',
                cookies: user.session.cookies,
                headers: {'x-csrf-token': other.session.csrfToken},
                payload: {variantId, quantity: 1},
            })

            expect(REJECTED).toContain(res.statusCode)
        })
    })

    describe('with a valid session', () => {
        it('works for a regular user', async () => {
            const data = await putInCart(user.api, variantId, 1)

            expect(data.items).toHaveLength(1)
            await user.api.delete('/cart')
        })

        it('is not restricted to the user role (an admin session can use its own cart)', async () => {
            const admin = await createUserSession(ctx, UserRole.ADMIN)

            const res = await admin.api.get('/cart')

            expect(res.statusCode).toBe(200)
        })

        it('keeps every user on their own cart: there is no way to address another user\'s cart', async () => {
            const a = await createUserSession(ctx)
            const b = await createUserSession(ctx)
            await putInCart(a.api, variantId, 3)

            expect((await getCart(b.api)).items).toEqual([])
            // removing "a"'s variant through "b" cannot reach a's line
            const res = await b.api.delete(`/cart/items/${variantId}`)
            expect(res.statusCode).toBe(404)
            expect((await getCart(a.api)).items).toHaveLength(1)
        })
    })

    describe('after logout', () => {
        it('rejects the old session on every route', async () => {
            const session = await createUserSession(ctx)
            await putInCart(session.api, variantId, 1)
            const logout = await session.api.post('/auth/logout')
            expect(logout.statusCode).toBe(200)

            for (const { method, url, body } of routes) {
                const res = await session.api.request(method, url(), body?.())
                expect(REJECTED).toContain(res.statusCode)
            }
        })
    })

    describe('input is validated only after authentication', () => {
        it('does not reveal validation details to anonymous callers', async () => {
            const res = await anonymous.post('/cart/items', {variantId: 'not-a-uuid', quantity: 999})

            expect(REJECTED).toContain(res.statusCode)
            expect(res.json().code).not.toBe('VALIDATION_ERROR')
        })

        it('still validates for authenticated callers', async () => {
            const res = await user.api.post('/cart/items', {variantId: randomId(), quantity: 999})

            expect(res.statusCode).toBe(400)
        })
    })
})
