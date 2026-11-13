import {NestFastifyApplication} from '@nestjs/platform-fastify'

import {IClearCartAfterOrder, IGetCheckoutCart} from '@api/cart/application'
import {UserRole, UserStatus} from '@api/users/domain'
import {CLEAR_CART_AFTER_ORDER, GET_CHECKOUT_CART} from '@common/di'
import {expect} from '@jest/globals'

import {TestContext} from '../test-context.e2e'
import {createUser, loginWithOtp, newPhone} from '../../../util/test.util'
import {Api, SeededVariant, Session, upsertUseCase, variantRepository} from '../product/product-test.util'

// Everything from the product helpers (seedVariants, createPublishedProduct, qs, expectError...) is
// available from this one module so cart specs have a single import.
export * from '../product/product-test.util'


/* ------------------------------------------------------------------ */
/* Cart helpers                                                        */
/* ------------------------------------------------------------------ */

export const EMPTY_CART = {
    items: [],
    coupon: {code: null, status: 'none'},
    totals: {itemCount: 0, subtotal: 0, productDiscountTotal: 0, couponDiscount: 0, total: 0},
    hasUnavailableLines: false,
}

export const addToCart = (api: Api, variantId: string, quantity?: number) =>
    api.post('/cart/items', quantity === undefined ? {variantId} : {variantId, quantity})

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

/** File key of the n-th image created by `setGallery` / `createPublishedProduct`. */
export const imageKeyOf = (productId: string, index = 0) => `products/${productId}/img-${index}.webp`

/* ------------------------------------------------------------------ */
/* Catalog mutations that happen "behind the cart's back"              */
/* ------------------------------------------------------------------ */

/** Re-sends one variant through the accounting sync (upsert) with some fields changed. */
export const changeVariant = async (
    app: NestFastifyApplication,
    variant: SeededVariant,
    changes: {
        price?: number
        stock?: number
        isActive?: boolean
        title?: string
        attributes?: { name: string; value: string }[]
    },
) => {
    const [current] = await variantRepository(app).findByExternalIds(variant.source, [variant.externalId])
    if (!current) throw new Error(`variant ${variant.externalId} not found`)

    return upsertUseCase(app).execute({
        source: variant.source,
        items: [
            {
                externalId: current.externalId,
                title: changes.title ?? current.title,
                sku: current.sku,
                price: changes.price ?? current.price,
                stock: changes.stock ?? current.stock,
                isActive: changes.isActive ?? current.isActive,
                attributes: changes.attributes ?? current.attributes.map((a) => ({name: a.name, value: a.value})),
            },
        ],
    })
}

export const unpublishProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/unpublish`)
    expect(res.statusCode).toBe(200)
}

export const archiveProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/archive`)
    expect(res.statusCode).toBe(200)
}

export const republishProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/publish`)
    expect(res.statusCode).toBe(200)
}

/* ------------------------------------------------------------------ */
/* System use cases (called by the order module, no HTTP endpoint)     */
/* ------------------------------------------------------------------ */

export const cartSystemUseCases = (app: NestFastifyApplication) => ({
    getCheckoutCart: app.get<IGetCheckoutCart>(GET_CHECKOUT_CART, {strict: false}),
    clearCartAfterOrder: app.get<IClearCartAfterOrder>(CLEAR_CART_AFTER_ORDER, {strict: false}),
})
