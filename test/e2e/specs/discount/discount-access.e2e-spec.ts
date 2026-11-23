import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, anonymousApi, apiWithoutCsrf, createUserSession, randomId, UserSession} from '../../util/test.util'
import {ALL, couponBody, createCoupon, createDiscount, discountBody} from './discount-test.util'

const REJECTED = [401, 403]

describe('Discounts and coupons: admin access control (e2e)', () => {
    let ctx: TestContext
    let admin: UserSession
    let shopper: UserSession
    let anonymous: Api
    let discountId: string
    let couponId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = await createUserSession(ctx, UserRole.ADMIN)
        shopper = await createUserSession(ctx, UserRole.USER)
        anonymous = anonymousApi(ctx.app)
        discountId = (await createDiscount(admin.api)).id
        couponId = (await createCoupon(admin.api)).id
    })
    type Route = {
        label: string
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
        url: () => string
        body?: () => unknown
    }

    const routes: Route[] = [
        {
            label: 'GET /admin/discounts',
            method: 'GET',
            url: () => '/admin/discounts',
        },
        {
            label: 'POST /admin/discounts',
            method: 'POST',
            url: () => '/admin/discounts',
            body: () => discountBody(),
        },
        {
            label: 'GET /admin/discounts/:id',
            method: 'GET',
            url: () => `/admin/discounts/${discountId}`,
        },
        {
            label: 'PATCH /admin/discounts/:id',
            method: 'PATCH',
            url: () => `/admin/discounts/${discountId}`,
            body: () => ({ name: 'x' }),
        },
        {
            label: 'DELETE /admin/discounts/:id',
            method: 'DELETE',
            url: () => `/admin/discounts/${randomId()}`,
        },
        {
            label: 'GET /admin/coupons',
            method: 'GET',
            url: () => '/admin/coupons',
        },
        {
            label: 'POST /admin/coupons',
            method: 'POST',
            url: () => '/admin/coupons',
            body: () => couponBody(),
        },
        {
            label: 'GET /admin/coupons/:id',
            method: 'GET',
            url: () => `/admin/coupons/${couponId}`,
        },
        {
            label: 'GET /admin/coupons/:id/usage',
            method: 'GET',
            url: () => `/admin/coupons/${couponId}/usage`,
        },
        {
            label: 'PATCH /admin/coupons/:id',
            method: 'PATCH',
            url: () => `/admin/coupons/${couponId}`,
            body: () => ({ name: 'x' }),
        },
        {
            label: 'DELETE /admin/coupons/:id',
            method: 'DELETE',
            url: () => `/admin/coupons/${randomId()}`,
        },
    ]

    const mutating = routes.filter(({ method }) => method !== 'GET')

    it.each(routes)(
        '$label is rejected without a session',
        async ({ method, url, body }) => {
            const response = await anonymous.request(method, url(), body?.())

            expect(REJECTED).toContain(response.statusCode)
        },
    )
    it.each(routes)('%s is rejected without a session', async ({ method, url, body }) => {
        expect(REJECTED).toContain((await anonymous.request(method, url(), body?.())).statusCode)
    })

    it.each(routes)('%s is forbidden for a non-admin user', async ({ method, url, body }) => {
        const res = await shopper.api.request(method, url(), body?.())

        expect(res.statusCode).toBe(403)
    })

    it.each(mutating)('%s is rejected for an admin without the CSRF header', async ({ method, url, body }) => {
        const res = await apiWithoutCsrf(ctx.app, admin.session).request(method, url(), body?.())
        expect(REJECTED).toContain(res.statusCode)
    })

    it('does not apply changes that were rejected', async () => {
        const before = (await admin.api.get(`/admin/discounts/${discountId}`)).json().data

        await shopper.api.patch(`/admin/discounts/${discountId}`, {name: 'hacked'})
        await apiWithoutCsrf(ctx.app, admin.session).patch(`/admin/discounts/${discountId}`, {name: 'hacked'})

        expect((await admin.api.get(`/admin/discounts/${discountId}`)).json().data).toEqual(before)
    })

    it('does not let a non-admin create anything', async () => {
        const body = couponBody()

        await shopper.api.post('/admin/coupons', body)

        const list = await admin.api.get('/admin/coupons?pageSize=100')
        expect((list.json().data.items as any[]).some((c) => c.code === body.code)).toBe(false)
    })

    it('rejects the old admin session after logout', async () => {
        const session = await createUserSession(ctx, UserRole.ADMIN)
        expect((await session.api.post('/auth/logout')).statusCode).toBe(200)

        for (const { method, url, body } of routes) {
            expect(REJECTED).toContain((await session.api.request(method, url(), body?.())).statusCode)
        }
    })

    it('authorises before validating input', async () => {
        expect(REJECTED).toContain((await anonymous.post('/admin/discounts', {scope: ALL})).statusCode)
        expect((await shopper.api.post('/admin/discounts', {scope: ALL})).statusCode).toBe(403)
        expect((await admin.api.post('/admin/discounts', {scope: ALL})).statusCode).toBe(400)
    })
})
