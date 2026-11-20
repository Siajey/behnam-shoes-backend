import {beforeAll, describe, expect, it} from '@jest/globals'

import {IGetPublishedProductIds, IGetPublishedProductsByIds} from '@api/product/application'
import {UserRole} from '@api/users/domain'
import {GET_PUBLISHED_PRODUCT_IDS, GET_PUBLISHED_PRODUCTS_BY_IDS} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, randomId} from '../../../util/test.util'
import {archiveProduct, createCategory, createDraftProduct, createPublishedProduct, unpublishProduct} from './product-test.util'

describe('Product system reads: published products by id (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let publishedIds: IGetPublishedProductIds
    let publishedProducts: IGetPublishedProductsByIds
    let live: {id: string; variantIds: string[]}[]
    let hidden: Record<'draft' | 'unpublished' | 'archived', string>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        publishedIds = ctx.app.get<IGetPublishedProductIds>(GET_PUBLISHED_PRODUCT_IDS, {strict: false})
        publishedProducts = ctx.app.get<IGetPublishedProductsByIds>(GET_PUBLISHED_PRODUCTS_BY_IDS, {strict: false})

        const category = await createCategory(admin)
        live = [
            await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{price: 1000}, {size: '41', price: 2000}]}),
            await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{price: 500}]}),
        ]
        const unpublished = await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{}]})
        await unpublishProduct(admin, unpublished.id)
        const archived = await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{}]})
        await archiveProduct(admin, archived.id)
        hidden = {
            draft: (await createDraftProduct(ctx.app, admin, [{}])).id,
            unpublished: unpublished.id,
            archived: archived.id,
        }
    })

    describe('GetPublishedProductIds', () => {
        it('returns only the ids of published products', async () => {
            const ids = await publishedIds.execute([...live.map((p) => p.id), ...Object.values(hidden)])

            expect([...ids].sort()).toEqual(live.map((p) => p.id).sort())
        })

        it('ignores unknown ids and returns [] for an empty input', async () => {
            expect(await publishedIds.execute([])).toEqual([])
            expect(await publishedIds.execute([randomId()])).toEqual([])
            expect(await publishedIds.execute([live[0].id, randomId()])).toEqual([live[0].id])
        })

        it('does not repeat an id given several times', async () => {
            expect(await publishedIds.execute([live[0].id, live[0].id, live[0].id])).toEqual([live[0].id])
        })

        it('follows status changes', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {variants: [{}]})
            expect(await publishedIds.execute([product.id])).toEqual([product.id])

            await unpublishProduct(admin, product.id)

            expect(await publishedIds.execute([product.id])).toEqual([])
        })
    })

    describe('GetPublishedProductsByIds', () => {
        it('returns the published products with their variants', async () => {
            const views = await publishedProducts.execute([...live.map((p) => p.id), ...Object.values(hidden)])

            expect(views.map((v) => v.product.id).sort()).toEqual(live.map((p) => p.id).sort())
            const first = views.find((v) => v.product.id === live[0].id)!
            expect(first.activeVariants.map((v) => v.id).sort()).toEqual([...live[0].variantIds].sort())
            expect([first.minPrice, first.maxPrice]).toEqual([1000, 2000])
        })

        it('returns [] for no ids, unknown ids and only-hidden products', async () => {
            expect(await publishedProducts.execute([])).toEqual([])
            expect(await publishedProducts.execute([randomId()])).toEqual([])
            expect(await publishedProducts.execute(Object.values(hidden))).toEqual([])
        })

        it('returns each product once even if its id is repeated', async () => {
            const views = await publishedProducts.execute([live[1].id, live[1].id])

            expect(views).toHaveLength(1)
        })
    })
})