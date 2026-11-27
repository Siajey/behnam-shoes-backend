import {expect} from '@jest/globals'

import {NestFastifyApplication} from '@nestjs/platform-fastify'

import {Api, UserSession, createUserSession} from '../../util/test.util'
import {Customer, adminStatus, createCustomer, fillCart, orderSystemUseCases, placeOk} from '../order/order-test.util'
import {TestContext} from '../test-context.e2e'

export type OrderState = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

/** REVIEW_REQUIRE_PURCHASE is read on every call (assumes ConfigProvider reads process.env lazily). */
export const withReviewPolicy = async (value: 'true' | 'false' | undefined, fn: () => Promise<void>) => {
    const before = process.env.REVIEW_REQUIRE_PURCHASE
    if (value === undefined) delete process.env.REVIEW_REQUIRE_PURCHASE
    else process.env.REVIEW_REQUIRE_PURCHASE = value
    try {
        await fn()
    } finally {
        if (before === undefined) delete process.env.REVIEW_REQUIRE_PURCHASE
        else process.env.REVIEW_REQUIRE_PURCHASE = before
    }
}

/** A customer with one order of the product in the given state (needs the shipping methods from ensureShippingMethods). */
export const buyer = async (ctx: TestContext, admin: Api, variantId: string, state: OrderState = 'shipped'): Promise<Customer> => {
    const customer = await createCustomer(ctx)
    await fillCart(customer.api, [{variantId, quantity: 1}])
    const order = await placeOk(customer)
    if (state === 'cancelled') {
        expect((await customer.api.post(`/orders/${order.id}/cancel`)).statusCode).toBe(200)
        return customer
    }
    if (state === 'pending_payment') return customer
    await orderSystemUseCases(ctx.app as NestFastifyApplication).markPaid.execute(order.id)
    if (state === 'paid') return customer
    expect((await adminStatus(admin, order.id, {action: 'startProcessing'})).statusCode).toBe(200)
    if (state === 'processing') return customer
    expect((await adminStatus(admin, order.id, {action: 'ship'})).statusCode).toBe(200)
    if (state === 'shipped') return customer
    expect((await adminStatus(admin, order.id, {action: 'deliver'})).statusCode).toBe(200)
    return customer
}

export const reviewUrl = (productId: string) => `/products/${productId}/reviews`
export const postReview = (api: Api, productId: string, body: Record<string, unknown> = {rating: 5}) => api.post(reviewUrl(productId), body)

export const reviewOk = async (api: Api, productId: string, body: Record<string, unknown> = {rating: 5}) => {
    const res = await postReview(api, productId, body)
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const listReviews = async (api: Api, productId: string, query = '') => {
    const res = await api.get(`${reviewUrl(productId)}${query}`)
    expect(res.statusCode).toBe(200)
    return res.json().data as {summary: any; items: any[]; nextCursor: string | null}
}

/** Creates `count` reviews from fresh users (use with the purchase rule switched off). */
export const manyReviews = async (ctx: TestContext, productId: string, ratings: number[]) => {
    const users: UserSession[] = []
    const reviews: any[] = []
    for (const rating of ratings) {
        const user = await createUserSession(ctx)
        users.push(user)
        reviews.push(await reviewOk(user.api, productId, {rating}))
        await new Promise((r) => setTimeout(r, 8)) // distinct createdAt, so newest-first order is known
    }
    return {users, reviews}
}
