import {expect} from '@jest/globals'

import {NestFastifyApplication} from '@nestjs/platform-fastify'

import {Api, uid} from '../../util/test.util'
import {Customer, adminStatus, fillCart, orderSystemUseCases, placeOk} from '../order/order-test.util'
import {methodTracker} from "./shipping-test.util";

export const MIN = 60_000
export const DAY = 24 * 60 * MIN
/** Assumes the default polling interval; set SHIPPING_TRACKING_INTERVAL_MINUTES to change it. */
export const INTERVAL = Number(process.env.SHIPPING_TRACKING_INTERVAL_MINUTES ?? 30)
export const backoff = (failures: number) => Math.min(INTERVAL * 2 ** Math.min(failures, 10), 360)

/** 12 letters/digits: valid for Tipax (10 to 18). */
export const tipaxCode = () => `TP${uid()}${uid()}`.slice(0, 12).toUpperCase()
/** 24 digits: valid for Iran Post. */
export const iranPostCode = () => Array.from({length: 24}, () => Math.floor(Math.random() * 10)).join('')

export const trackingEvent = (key: string, status: string, at: string | Date, description = key, location: string | null = null) => ({
    key, status: status as any, description, location, occurredAt: new Date(at),
})
export const trackingOf = (status: string, events: ReturnType<typeof trackingEvent>[] = []) => ({status: status as any, events})

/** One method per carrier kind (all priced by the rate table / fake), created once per spec file. */
export const carrierMethods = async (admin: Api) => ({
    tipax: await methodTracker(admin).create({carrier: 'tipax', service: 'express', name: 'Tipax'}),
    iranPost: await methodTracker(admin).create({carrier: 'iran_post', service: 'post', name: 'Iran Post'}),
    fake: await methodTracker(admin).create({carrier: 'fake', service: 'svc', name: 'Fake'}),
    table: await methodTracker(admin).create({carrier: 'rate_table', service: 'post', name: 'Table'}),
})

/** An order that is paid and in processing, ready to be shipped. */
export const processingOrder = async (app: NestFastifyApplication, admin: Api, customer: Customer, variantId: string, methodCode: string) => {
    await customer.api.delete('/cart')
    await fillCart(customer.api, [{variantId, quantity: 1}])
    const order = await placeOk(customer, {shippingMethod: methodCode})
    await orderSystemUseCases(app).markPaid.execute(order.id)
    expect((await adminStatus(admin, order.id, {action: 'startProcessing'})).statusCode).toBe(200)
    return order.id as string
}

export const shippedOrder = async (app: NestFastifyApplication, admin: Api, customer: Customer, variantId: string, methodCode: string, trackingCode: string) => {
    const id = await processingOrder(app, admin, customer, variantId, methodCode)
    const res = await adminStatus(admin, id, {action: 'ship', trackingCode})
    expect(res.statusCode).toBe(200)
    return id
}