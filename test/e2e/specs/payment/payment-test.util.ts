import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {Api, anonymousApi} from '../../util/api.util'
import {Customer, fillCart, placeOk} from '../order/order-test.util'

/** A fresh pending order with `quantity` units of the variant (the cart is emptied first, it persists between orders). */
export const orderFor = async (customer: Customer, variantId: string, quantity = 1) => {
    await customer.api.delete('/cart')
    await fillCart(customer.api, [{variantId, quantity}])
    return placeOk(customer)
}

export const startPayment = (customer: Customer, orderId: string, body: Record<string, unknown> = {}) =>
    customer.api.post('/payments', {orderId, ...body})

export const startOk = async (customer: Customer, orderId: string, body: Record<string, unknown> = {}) => {
    const res = await startPayment(customer, orderId, body)
    expect(res.statusCode).toBe(201)
    const data = res.json().data as {paymentId: string; redirectUrl: string}
    return {...data, reference: data.redirectUrl.split('/').pop()!}
}
const buildCallbackUrl = (gateway: string, query: Record<string, string | string[]>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) {
            for (const item of value) search.append(key, String(item))
        } else {
            search.append(key, String(value))
        }
    }
    const serialized = search.toString()
    return serialized ? `/payments/callback/${gateway}?${serialized}` : `/payments/callback/${gateway}`
}

export const callbackGet = (
    app: NestFastifyApplication,
    query: Record<string, string | string[]> | Record<string, string> = {},
    gateway = 'zibal',
) => anonymousApi(app).get(buildCallbackUrl(gateway, query))

export const callbackPost = (app: NestFastifyApplication, body: Record<string, unknown>, gateway = 'zibal') =>
    anonymousApi(app).post(`/payments/callback/${gateway}`, body)

/** Parses the redirect the callback answers with. */
export const redirectOf = (res: {statusCode: number; headers: Record<string, any>}) => {
    expect(res.statusCode).toBe(302)
    const url = new URL(res.headers.location as string)
    return {base: `${url.origin}${url.pathname}`, params: Object.fromEntries(url.searchParams) as Record<string, string>}
}

export const getPayment = async (api: Api, paymentId: string) => {
    const res = await api.get(`/payments/${paymentId}`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const orderPayments = async (admin: Api, orderId: string) => {
    const res = await admin.get(`/admin/orders/${orderId}/payments`)
    expect(res.statusCode).toBe(200)
    return res.json().data.items as any[]
}

const appendQuery = (url: string, query: Record<string, unknown>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) {
            for (const item of value) search.append(key, String(item))
        } else {
            search.append(key, String(value))
        }
    }
    const serialized = search.toString()
    return serialized ? `${url}${url.includes('?') ? '&' : '?'}${serialized}` : url
}