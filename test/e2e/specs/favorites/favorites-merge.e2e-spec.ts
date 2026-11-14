import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, createUserSession, expectOk, expectValidationError, randomId, sleep} from '../../../util/test.util'
import {createPublishedProduct, unpublishProduct} from '../product/product-test.util'
import {
    favoriteIds,
    fillFavorites,
    listFavorites,
    mergeFavorites,
    putFavorite,
    resetFavorites,
    storedFavorites,
} from './favorites-test.util'

describe('Favorites: POST /favorites/merge (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
    })

    beforeEach(async () => {
        await resetFavorites(ctx.app, user.userId)
    })

    const published = () => createPublishedProduct(ctx.app, admin, {variants: [{}]})

    const merge = async (productIds: string[]) => {
        const res = await mergeFavorites(user.api, productIds)
        expectOk(res, 200, 'FAVORITES_MERGE_SUCCESS')
        return res.json().data as { added: number; skippedProductIds: string[] }
    }

    it('adds the guest favorites, keeping the request order (first = newest)', async () => {
        const [a, b, c] = [await published(), await published(), await published()]

        const result = await merge([a.id, b.id, c.id])

        expect(result).toEqual({added: 3, skippedProductIds: []})
        expect(await favoriteIds(user.api)).toEqual([a.id, b.id, c.id])
    })

    it('skips unknown and unpublished products, reporting them in request order', async () => {
        const [good, hidden] = [await published(), await published()]
        await unpublishProduct(admin, hidden.id)
        const unknown = randomId()

        const result = await merge([unknown, good.id, hidden.id])

        expect(result).toEqual({added: 1, skippedProductIds: [unknown, hidden.id]})
        expect(await favoriteIds(user.api)).toEqual([good.id])
    })

    it('does not touch products that are already favorites (neither added nor skipped)', async () => {
        const [existing, fresh] = [await published(), await published()]
        await putFavorite(user.api, existing.id)
        const before = (await listFavorites(user.api)).items[0].favoritedAt
        await sleep(15)

        const result = await merge([existing.id, fresh.id])

        expect(result).toEqual({added: 1, skippedProductIds: []})
        const {items} = await listFavorites(user.api)
        expect(items.find((i) => i.productId === existing.id).favoritedAt).toBe(before)
        expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(2)
    })

    it('ignores duplicate ids in the request', async () => {
        const product = await published()

        expect(await merge([product.id, product.id, product.id])).toEqual({added: 1, skippedProductIds: []})
        expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(1)
    })

    it('is idempotent when the same guest list is merged twice', async () => {
        const [a, b] = [await published(), await published()]
        await merge([a.id, b.id])

        expect(await merge([a.id, b.id])).toEqual({added: 0, skippedProductIds: []})
        expect(await favoriteIds(user.api)).toEqual([a.id, b.id])
    })

    it('adds nothing when every product is skipped', async () => {
        const unknown = [randomId(), randomId()]

        expect(await merge(unknown)).toEqual({added: 0, skippedProductIds: unknown})
        expect(await favoriteIds(user.api)).toEqual([])
    })

    it('stops at the limit of 200 and reports the overflow as skipped', async () => {
        const [a, b] = [await published(), await published()]
        await fillFavorites(ctx.app, user.userId, 199)

        const result = await merge([a.id, b.id])

        expect(result).toEqual({added: 1, skippedProductIds: [b.id]})
        expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(200)
    })

    describe('validation', () => {
        it.each([
            ['a missing productIds', {}],
            ['a non-array', {productIds: 'abc'}],
            ['an empty array', {productIds: []}],
            ['a malformed uuid', {productIds: ['nope']}],
            ['more than 200 ids', {productIds: Array.from({length: 201}, () => randomId())}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await user.api.post('/favorites/merge', body))
        })

        it('accepts exactly 200 ids', async () => {
            const res = await mergeFavorites(user.api, Array.from({length: 200}, () => randomId()))

            expect(res.statusCode).toBe(200)
            expect(res.json().data.skippedProductIds).toHaveLength(200)
        })
    })
})
