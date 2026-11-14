import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    createUserSession,
    expectOk,
    expectValidationError,
    qs,
    sleep,
    walkPages,
} from '../../../util/test.util'
import {
    changeVariant,
    createCategory,
    createPublishedProduct,
    imageKeyOf,
    publishProduct,
    unpublishProduct,
} from '../product/product-test.util'
import {
    EMPTY_PAGE,
    favoriteIds,
    listFavorites,
    mergeFavorites,
    putFavorite,
    resetFavorites,
    storedFavorites,
} from './favorites-test.util'

describe('Favorites: list and ids (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession
    let a: Awaited<ReturnType<typeof createPublishedProduct>>
    let b: typeof a
    let c: typeof a

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
        a = await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 5}, {size: '41', price: 1500, stock: 0}]})
        b = await createPublishedProduct(ctx.app, admin, {variants: [{price: 2000, stock: 3}]})
        c = await createPublishedProduct(ctx.app, admin, {variants: [{price: 3000, stock: 0}]})
    })

    beforeEach(async () => {
        await resetFavorites(ctx.app, user.userId)
    })

    const favoriteInOrder = async (...products: { id: string }[]) => {
        for (const p of products) {
            await putFavorite(user.api, p.id)
            await sleep(10)
        }
    }

    it('returns an empty page and no ids for a user without favorites', async () => {
        const res = await user.api.get('/favorites')

        expectOk(res, 200, 'FAVORITES_LIST_SUCCESS')
        expect(res.json().data).toEqual(EMPTY_PAGE)
        const ids = await user.api.get('/favorites/ids')
        expectOk(ids, 200, 'FAVORITES_IDS_SUCCESS')
        expect(ids.json().data).toEqual({productIds: []})
    })

    it('returns exactly the public item shape built from the live catalog', async () => {
        await putFavorite(user.api, a.id)

        const {items} = await listFavorites(user.api)

        expect(items).toEqual([
            {
                productId: a.id,
                name: a.name,
                slug: a.slug,
                imageKey: imageKeyOf(a.id),
                minPrice: 1000,
                maxPrice: 1500,
                inStock: true,
                favoritedAt: expect.any(String),
            },
        ])
    })

    it('lists the newest favorite first, in both /favorites and /favorites/ids', async () => {
        await favoriteInOrder(a, b, c)

        expect((await listFavorites(user.api)).items.map((i) => i.productId)).toEqual([c.id, b.id, a.id])
        expect(await favoriteIds(user.api)).toEqual([c.id, b.id, a.id])
    })

    it('follows price and stock changes', async () => {
        await putFavorite(user.api, b.id)
        const variant = b.variants[0]

        await changeVariant(ctx.app, variant, {price: 2500})
        expect((await listFavorites(user.api)).items[0]).toMatchObject({minPrice: 2500, maxPrice: 2500, inStock: true})

        await changeVariant(ctx.app, variant, {stock: 0})
        expect((await listFavorites(user.api)).items[0].inStock).toBe(false)
    })

    it('hides favorites of unpublished products without deleting them, and restores them when republished', async () => {
        const hidden = await createPublishedProduct(ctx.app, admin, {variants: [{}]})
        await favoriteInOrder(a, hidden, c)
        const before = (await listFavorites(user.api)).items.find((i) => i.productId === hidden.id)

        await unpublishProduct(admin, hidden.id)

        expect((await listFavorites(user.api)).items.map((i) => i.productId)).toEqual([c.id, a.id])
        expect(await favoriteIds(user.api)).toEqual([c.id, a.id])
        expect(await storedFavorites(ctx.app, user.userId)).toHaveLength(3)

        await publishProduct(admin, hidden.id)

        const after = (await listFavorites(user.api)).items
        expect(after.map((i) => i.productId)).toEqual([c.id, hidden.id, a.id])
        expect(after.find((i) => i.productId === hidden.id).favoritedAt).toBe(before.favoritedAt)
    })

    it('keeps users separate', async () => {
        const other = await createUserSession(ctx)
        await putFavorite(user.api, a.id)
        await putFavorite(other.api, b.id)

        expect(await favoriteIds(user.api)).toEqual([a.id])
        expect(await favoriteIds(other.api)).toEqual([b.id])
    })

    describe('pagination', () => {
        it('pages with pageSize and a cursor, ending with a null cursor', async () => {
            await favoriteInOrder(a, b, c)

            const first = await listFavorites(user.api, {pageSize: 2})
            expect(first.items.map((i) => i.productId)).toEqual([c.id, b.id])
            expect(typeof first.nextCursor).toBe('string')

            const second = await listFavorites(user.api, {pageSize: 2, nextCursor: first.nextCursor})
            expect(second).toEqual({items: [expect.objectContaining({productId: a.id})], nextCursor: null})
        })

        it('returns no cursor when the last page is exactly full', async () => {
            await favoriteInOrder(a, b)

            expect((await listFavorites(user.api, {pageSize: 2})).nextCursor).toBeNull()
        })

        it('walks without gaps or duplicates and ignores a malformed cursor', async () => {
            await favoriteInOrder(a, b, c)

            const pages = await walkPages(user.api, '/favorites', {pageSize: 1})
            expect(pages.flatMap((p) => p.items.map((i: any) => i.productId))).toEqual([c.id, b.id, a.id])

            const res = await user.api.get(`/favorites${qs({nextCursor: 'garbage'})}`)
            expect(res.json().data.items).toHaveLength(3)
        })

        it('uses a default page size of 20 and accepts up to 50', async () => {
            const category = await createCategory(admin)
            const many: any = []
            for (let i = 0; i < 21; i++) many.push(await createPublishedProduct(ctx.app, admin, {categoryId: category.id}))
            expect((await mergeFavorites(user.api, many.map((p) => p.id))).json().data.added).toBe(21)

            const first = await listFavorites(user.api)
            expect(first.items).toHaveLength(20)
            expect(first.nextCursor).not.toBeNull()
            expect((await listFavorites(user.api, {pageSize: 50})).items).toHaveLength(21)
        })

        it.each([
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=51', {pageSize: 51}],
            ['pageSize=-1', {pageSize: -1}],
            ['pageSize=abc', {pageSize: 'abc'}],
            ['pageSize=1.5', {pageSize: 1.5}],
            ['a cursor over 200 characters', {nextCursor: 'x'.repeat(201)}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await user.api.get(`/favorites${qs(params as any)}`))
        })
    })
})
