import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, anonymousApi, apiWithoutCsrf, createUserSession, randomId} from '../../../util/test.util'
import {createPublishedProduct} from '../product/product-test.util'
import {favoriteIds, putFavorite} from './favorites-test.util'

const REJECTED = [401, 403]

describe('Favorites: access control (e2e)', () => {
    let ctx: TestContext
    let user: UserSession
    let anonymous: Api
    let productId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        anonymous = anonymousApi(ctx.app)
        user = await createUserSession(ctx)
        const admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        productId = (await createPublishedProduct(ctx.app, admin, {variants: [{}]})).id
    })

    type Route = {
        label: string
        method: 'GET' | 'POST' | 'PUT' | 'DELETE'
        url: () => string
        body?: () => unknown
    }

    const routes: Route[] = [
        {
            label: 'GET /favorites',
            method: 'GET',
            url: () => '/favorites',
        },
        {
            label: 'GET /favorites/ids',
            method: 'GET',
            url: () => '/favorites/ids',
        },
        {
            label: 'PUT /favorites/:productId',
            method: 'PUT',
            url: () => `/favorites/${productId}`,
            body: () => ({}),
        },
        {
            label: 'DELETE /favorites/:productId',
            method: 'DELETE',
            url: () => `/favorites/${productId}`,
        },
        {
            label: 'POST /favorites/merge',
            method: 'POST',
            url: () => '/favorites/merge',
            body: () => ({ productIds: [productId] }),
        },
    ]

    const mutating = routes.filter(({ method }) => method !== 'GET')

    it.each(routes)('$label is rejected without a session', async ({ method, url, body }) => {
        const response = await anonymous.request(method, url(), body?.())

        expect(REJECTED).toContain(response.statusCode)
    })

    it.each(mutating)('%s is rejected without the CSRF header', async ({ method, url, body }) => {
        const res = await apiWithoutCsrf(ctx.app, user.session).request(method, url(), body?.())

        expect(REJECTED).toContain(res.statusCode)
    })

    it.each(mutating)('%s is rejected with a wrong CSRF token', async ({ method, url, body }) => {
        const res = await ctx.app.inject({
            method,
            url: url(),
            cookies: user.session.cookies,
            headers: {'x-csrf-token': 'x'.repeat(64)},
            payload: (body?.() ?? undefined) as any,
        })

        expect(REJECTED).toContain(res.statusCode)
    })

    it('does not apply a change that was rejected', async () => {
        const fresh = await createUserSession(ctx)

        await apiWithoutCsrf(ctx.app, fresh.session).put(`/favorites/${productId}`)

        expect(await favoriteIds(fresh.api)).toEqual([])
    })

    it('rejects the old session after logout', async () => {
        const session = await createUserSession(ctx)
        await putFavorite(session.api, productId)
        expect((await session.api.post('/auth/logout')).statusCode).toBe(200)

        for (const { method, url, body } of routes) {
            expect(REJECTED).toContain((await session.api.request(method, url(), body?.())).statusCode)
        }
    })

    it('validates input only for authenticated callers', async () => {
        expect(REJECTED).toContain((await anonymous.put('/favorites/not-a-uuid')).statusCode)
        expect((await user.api.put('/favorites/not-a-uuid')).statusCode).toBe(400)
        expect((await user.api.put(`/favorites/${randomId()}`)).statusCode).toBe(404)
    })
})
