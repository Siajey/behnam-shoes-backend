import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {IClearCartAfterOrder, IGetCheckoutCart} from '@api/cart/application'
import {CLEAR_CART_AFTER_ORDER, GET_CHECKOUT_CART} from '@common/di'

import {Api} from '../../../util/test.util'

/* Cart-only helpers. Shared helpers (Api, sessions, assertions, ids) live in test/util/test.util,
 * catalog helpers (published products, variants, changeVariant) in ../product/product-test.util. */

export const EMPTY_CART = {
    items: [],
    coupon: {code: null, status: 'none'},
    totals: {itemCount: 0, subtotal: 0, productDiscountTotal: 0, couponDiscount: 0, total: 0},
    hasUnavailableLines: false,
}

export const addToCart = (api: Api, variantId: string, quantity?: number) =>
    api.post('/cart/items', quantity === undefined ? {variantId} : {variantId, quantity})

/** Adds to the cart, expects 200 and returns the cart view. */
export const putInCart = async (api: Api, variantId: string, quantity?: number) => {
    const res = await addToCart(api, variantId, quantity)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const getCart = async (api: Api) => {
    const res = await api.get('/cart')
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const clearCartOf = async (api: Api) => {
    const res = await api.delete('/cart')
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const mergeCart = (api: Api, items: { variantId: string; quantity: number }[]) =>
    api.post('/cart/merge', {items})

export const lineOf = (cart: any, variantId: string) =>
    (cart.items as any[]).find((line) => line.variantId === variantId)

export const variantIdsInCart = (cart: any) => (cart.items as any[]).map((line) => line.variantId as string)

/** Use cases the order module calls directly (no HTTP endpoint). */
export const cartSystemUseCases = (app: NestFastifyApplication) => ({
    getCheckoutCart: app.get<IGetCheckoutCart>(GET_CHECKOUT_CART, {strict: false}),
    clearCartAfterOrder: app.get<IClearCartAfterOrder>(CLEAR_CART_AFTER_ORDER, {strict: false}),
})
