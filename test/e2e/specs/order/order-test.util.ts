import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect, jest} from '@jest/globals'

import {
    IExpireUnpaidOrders,
    IGetOrderPaymentInfo,
    IGetPayableOrder,
    IMarkOrderPaid,
} from '@api/order/application'
import {
    EXPIRE_UNPAID_ORDERS,
    GET_ORDER_PAYMENT_INFO,
    GET_PAYABLE_ORDER,
    MARK_ORDER_PAID,
} from '@common/di'

import {TestContext} from '../test-context.e2e'
import {Api, UserSession, createUserSession, uid} from '../../util/test.util'
import {putInCart} from '../cart/cart-test.util'

/* Order-only helpers. Shared helpers live in test/util/test.util; catalog, cart and discount helpers
 * next to their specs (../product, ../cart, ../discount). */

export const ADDRESS = {street: 'Valiasr St 12', city: 'Tehran', province: 'Tehran', postalCode: '1234567899'}
export const PROFILE = {firstName: 'Sara', lastName: 'Ahmadi'}
export const CURRENCY = process.env.SHOP_CURRENCY ?? 'IRT'
export const PAYMENT_WINDOW_MS = 30 * 60_000

/* ------------------------------------------------------------------ */
/* Customers and placing orders                                        */
/* ------------------------------------------------------------------ */

export interface Customer extends UserSession {
    addressId: string
}

/** A logged-in user with a profile (first/last name) and one saved address, ready to order. */
export const createCustomer = async (
    ctx: TestContext,
    options: { withProfile?: boolean; withAddress?: boolean } = {},
): Promise<Customer> => {
    const user = await createUserSession(ctx)
    if (options.withProfile !== false) {
        expect((await user.api.patch('/users/me', PROFILE)).statusCode).toBe(200)
    }
    let addressId = ''
    if (options.withAddress !== false) {
        const res = await user.api.post('/users/me/addresses', ADDRESS)
        expect(res.statusCode).toBe(201)
        addressId = res.json().data.id
    }
    return {...user, addressId}
}

export const newKey = () => `key-${uid()}-${uid()}`

export const fillCart = async (api: Api, items: { variantId: string; quantity?: number }[]) => {
    for (const item of items) await putInCart(api, item.variantId, item.quantity)
}
export const placeOrder = (customer: Customer, body: Record<string, unknown> = {}, key: string | null = newKey()) =>
    customer.api.post(
        '/orders',
        {addressId: customer.addressId, shippingMethod: 'post', ...body},
        key === null ? undefined : {'idempotency-key': key},
    )

export const placeOk = async (customer: Customer, body: Record<string, unknown> = {}, key?: string) => {
    const res = await placeOrder(customer, body, key ?? newKey())
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const getOrder = async (api: Api, id: string) => {
    const res = await api.get(`/orders/${id}`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const getAdminOrder = async (admin: Api, id: string) => {
    const res = await admin.get(`/admin/orders/${id}`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const adminStatus = (admin: Api, id: string, body: Record<string, unknown>) =>
    admin.post(`/admin/orders/${id}/status`, body)

export const statusesOf = (timeline: { status: string; at: string }[]) =>
    [...timeline].sort((a, b) => a.at.localeCompare(b.at)).map((e) => e.status)

/* ------------------------------------------------------------------ */
/* System use cases (called by the payment module / the expiry job)    */
/* ------------------------------------------------------------------ */

export const orderSystemUseCases = (app: NestFastifyApplication) => ({
    markPaid: app.get<IMarkOrderPaid>(MARK_ORDER_PAID, {strict: false}),
    expireUnpaid: app.get<IExpireUnpaidOrders>(EXPIRE_UNPAID_ORDERS, {strict: false}),
    getPayable: app.get<IGetPayableOrder>(GET_PAYABLE_ORDER, {strict: false}),
    getPaymentInfo: app.get<IGetOrderPaymentInfo>(GET_ORDER_PAYMENT_INFO, {strict: false}),
})
