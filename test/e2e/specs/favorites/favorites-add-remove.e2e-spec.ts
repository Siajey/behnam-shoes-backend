import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    sleep,
} from '../../../util/test.util'
import {archiveProduct, createDraftProduct, createPublishedProduct, unpublishProduct} from '../product/product-test.util'
import {favoriteIds, fillFavorites, listFavorites, putFavorite, resetFavorites, storedFavorites} from './favorites-test.util'

describe('Favorites: add and remove (e2e)', () => {
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

    describe('PUT /favorites/:productId', () => {
        it('favorites a published product', async () => {
            const product = await published()

            const res = await user.api.put(`/favorites/${product.id}`)

            expectOk(res, 200, 'FAVORITES_ADD_SUCCESS')
            expect(res.json().data).toEqual({productId: product.id, favorited: true})
            expect(await favoriteIds(user.api)).toEqual([product.id])
        })

        it('is idempotent and keeps the original favoritedAt', async () => {
            const product = await published()
            await putFavorite(user.api, product.id)
            const first = (await listFavorites(user.api)).items[0].favoritedAt
            await sleep(15)

            await putFavorite(user.api, product.id)

            const {items} = await listFavorites(user.api)
            expect(items).toHaveLength(1)
            expect(items[0].favoritedAt).toBe(first)
            expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(1)
        })

        it.each([
            ['an unknown product', async () => randomId()],
            ['a draft product', async () => (await createDraftProduct(ctx.app, admin, [{}])).id],
            [
                'an unpublished product',
                async () => {
                    const p = await published()
                    await unpublishProduct(admin, p.id)
                    return p.id
                },
            ],
            [
                'an archived product',
                async () => {
                    const p = await published()
                    await archiveProduct(admin, p.id)
                    return p.id
                },
            ],
        ])('rejects %s with 404 and stores nothing', async (_label, arrange) => {
            expectError(await user.api.put(`/favorites/${await arrange()}`), 404, 'FAVORITE_PRODUCT_NOT_FOUND')

            expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(0)
        })

        it('rejects a malformed product id', async () => {
            expectValidationError(await user.api.put('/favorites/not-a-uuid'))
        })

        it('enforces the limit of 200 favorites (stored ones count, even hidden), but stays idempotent', async () => {
            const [first, second] = [await published(), await published()]
            await fillFavorites(ctx.app, user.userId, 199)

            await putFavorite(user.api, first.id)
            expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(200)

            expectError(await user.api.put(`/favorites/${second.id}`), 400, 'FAVORITE_LIMIT_REACHED')
            expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(200)
            // re-adding an existing favorite at full capacity is still fine
            expect((await user.api.put(`/favorites/${first.id}`)).statusCode).toBe(200)
        })

        it('allows adding again once room is freed', async () => {
            const [first, second] = [await published(), await published()]
            await fillFavorites(ctx.app, user.userId, 200)
            expectError(await user.api.put(`/favorites/${first.id}`), 400, 'FAVORITE_LIMIT_REACHED')

            const [oldest] = (await storedFavorites(ctx.app, user.userId)).slice(-1)
            await user.api.delete(`/favorites/${oldest.productId}`)

            expect((await user.api.put(`/favorites/${second.id}`)).statusCode).toBe(200)
        })
    })

    describe('DELETE /favorites/:productId', () => {
        it('removes a favorite', async () => {
            const [keep, drop] = [await published(), await published()]
            await putFavorite(user.api, keep.id)
            await putFavorite(user.api, drop.id)

            const res = await user.api.delete(`/favorites/${drop.id}`)

            expectOk(res, 200, 'FAVORITES_REMOVE_SUCCESS')
            expect(res.json().data).toEqual({productId: drop.id, favorited: false})
            expect(await favoriteIds(user.api)).toEqual([keep.id])
        })

        it('succeeds when the product was not favorited or does not exist', async () => {
            const product = await published()

            expect((await user.api.delete(`/favorites/${product.id}`)).statusCode).toBe(200)
            expect((await user.api.delete(`/favorites/${randomId()}`)).statusCode).toBe(200)
        })

        it('can remove a favorite whose product is no longer published', async () => {
            const product = await published()
            await putFavorite(user.api, product.id)
            await unpublishProduct(admin, product.id)

            expect((await user.api.delete(`/favorites/${product.id}`)).statusCode).toBe(200)
            expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(0)
        })

        it('only affects the caller', async () => {
            const other = await createUserSession(ctx)
            const product = await published()
            await putFavorite(user.api, product.id)
            await putFavorite(other.api, product.id)

            await user.api.delete(`/favorites/${product.id}`)

            expect(await favoriteIds(user.api)).toEqual([])
            expect(await favoriteIds(other.api)).toEqual([product.id])
        })

        it('moves a re-added favorite to the top of the list', async () => {
            const [a, b] = [await published(), await published()]
            await putFavorite(user.api, a.id)
            await sleep(10)
            await putFavorite(user.api, b.id)
            await user.api.delete(`/favorites/${a.id}`)
            await sleep(10)
            await putFavorite(user.api, a.id)

            expect(await favoriteIds(user.api)).toEqual([a.id, b.id])
        })

        it('rejects a malformed id (including the word "merge")', async () => {
            expectValidationError(await user.api.delete('/favorites/not-a-uuid'))
            expectValidationError(await user.api.delete('/favorites/merge'))
        })
    })
})
