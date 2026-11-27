import {afterEach, beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {IGetProductById, IReplaceProductStats} from '@api/product/application'
import {UserRole} from '@api/users/domain'
import {GET_PRODUCT_BY_ID, REPLACE_PRODUCT_STATS} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {anonymousApi, Api, createUserSession, qs, randomId, withNowPlus} from '../../util/test.util'
import {DAY, discountTracker, HOUR, isoFromNow, scope} from '../discount/discount-test.util'
import {changeVariant, createBrand, createCategory, createPublishedProduct, VariantSeed,} from './product-test.util'

describe('Public products: meta (pricing, discounts, tags) (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    let discounts: ReturnType<typeof discountTracker>
    let replaceStats: IReplaceProductStats
    let getById: IGetProductById

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        anonymous = anonymousApi(ctx.app)
        discounts = discountTracker(admin)
        replaceStats = ctx.app.get<IReplaceProductStats>(REPLACE_PRODUCT_STATS, {strict: false})
        getById = ctx.app.get<IGetProductById>(GET_PRODUCT_BY_ID, {strict: false})
    })

    beforeEach(async () => {
        await replaceStats.execute({items: []})
    })

    afterEach(async () => {
        await discounts.cleanup()
    })

    const product = (variants: VariantSeed[], options: Record<string, unknown> = {}) =>
        createPublishedProduct(ctx.app, admin, {variants, ...options})
    const detail = async (id: string) => (await anonymous.get(`/products/${id}`)).json().data
    const metaOf = async (id: string) => (await detail(id)).meta
    const pricingOf = async (id: string) => (await metaOf(id)).pricing

    const NO_DISCOUNT = (min: number, max: number) => ({
        minPrice: min,
        maxPrice: max,
        finalMinPrice: min,
        finalMaxPrice: max,
        hasDiscount: false,
        maxDiscountPercent: 0,
    })

    describe('shape', () => {
        it('is present on list, search, detail by id and detail by slug', async () => {
            const p = await product([{price: 1000}], {name: `Meta shape ${randomId().slice(0, 8)}`})

            const byId = (await detail(p.id)).meta
            const bySlug = (await anonymous.get(`/products/slug/${p.slug}`)).json().data.meta
            const listed = (await anonymous.get(`/products${qs({pageSize: 100})}`)).json().data.items.find((i: any) => i.id === p.id)
            const searched = (await anonymous.get(`/products/search${qs({q: p.name})}`)).json().data.items[0]

            expect(byId).toEqual({
                tags: ['newest'],
                rating: {average: 0, count: 0},
                pricing: NO_DISCOUNT(1000, 1000)
            })
            expect(bySlug).toEqual(byId)
            expect(listed.meta).toEqual(byId)
            expect(searched.meta).toEqual(byId)
        })

        it('keeps the original prices in minPrice/maxPrice next to the meta', async () => {
            const p = await product([{price: 1000}])
            await discounts.create({value: 20, scope: scope('product', p.id)})

            const data = await detail(p.id)

            expect(data).toMatchObject({minPrice: 1000, maxPrice: 1000})
            expect(data.meta.pricing).toMatchObject({finalMinPrice: 800, finalMaxPrice: 800})
        })

        it('is not part of the admin responses', async () => {
            const p = await product([{}])

            const adminDetail = (await admin.get(`/admin/products/${p.id}`)).json().data
            const adminList = (await admin.get('/admin/products?pageSize=100')).json().data.items[0]

            expect(adminDetail).not.toHaveProperty('meta')
            expect(adminList).not.toHaveProperty('meta')
        })

        it('is computed per product when many are listed', async () => {
            const [cheap, discounted] = [await product([{price: 500}]), await product([{price: 2000}])]
            await discounts.create({value: 50, scope: scope('product', discounted.id)})

            const items = (await anonymous.get(`/products${qs({pageSize: 100})}`)).json().data.items as any[]

            expect(items.find((i) => i.id === cheap.id).meta.pricing).toEqual(NO_DISCOUNT(500, 500))
            expect(items.find((i) => i.id === discounted.id).meta.pricing).toEqual({
                minPrice: 2000,
                maxPrice: 2000,
                finalMinPrice: 1000,
                finalMaxPrice: 1000,
                hasDiscount: true,
                maxDiscountPercent: 50,
            })
        })
    })

    describe('pricing and discounts', () => {
        it('has no discount by default', async () => {
            const p = await product([{price: 1000}, {size: '41', price: 2000}])

            expect(await pricingOf(p.id)).toEqual(NO_DISCOUNT(1000, 2000))
        })

        it('shows final prices and the percent for a percent discount', async () => {
            const p = await product([{price: 1000}, {size: '41', price: 2000}])
            await discounts.create({value: 20, scope: scope('product', p.id)})

            expect(await pricingOf(p.id)).toEqual({
                minPrice: 1000,
                maxPrice: 2000,
                finalMinPrice: 800,
                finalMaxPrice: 1600,
                hasDiscount: true,
                maxDiscountPercent: 20,
            })
        })

        it('derives the percent of a fixed discount per variant and reports the largest', async () => {
            const p = await product([{price: 1000}, {size: '41', price: 2000}])
            await discounts.create({kind: 'fixed', value: 300, scope: scope('product', p.id)})

            // 300 off 1000 = 30%, 300 off 2000 = 15%
            expect(await pricingOf(p.id)).toEqual({
                minPrice: 1000,
                maxPrice: 2000,
                finalMinPrice: 700,
                finalMaxPrice: 1700,
                hasDiscount: true,
                maxDiscountPercent: 30,
            })
        })

        it('reports at least 1% for any real discount and 100% for a free product', async () => {
            const pricey = await product([{price: 1_000_000}])
            const free = await product([{price: 500}])
            await discounts.create({kind: 'fixed', value: 1, scope: scope('product', pricey.id)})
            await discounts.create({value: 100, scope: scope('product', free.id)})

            expect(await pricingOf(pricey.id)).toMatchObject({
                finalMinPrice: 999_999,
                hasDiscount: true,
                maxDiscountPercent: 1
            })
            expect(await pricingOf(free.id)).toMatchObject({
                finalMinPrice: 0,
                finalMaxPrice: 0,
                maxDiscountPercent: 100
            })
        })

        it('handles a discount that only applies to some variants', async () => {
            const p = await product([{price: 1000}, {size: '41', price: 2000}])
            await discounts.create({value: 50, scope: scope('variant', p.variantIds[0])})

            expect(await pricingOf(p.id)).toEqual({
                minPrice: 1000,
                maxPrice: 2000,
                finalMinPrice: 500,
                finalMaxPrice: 2000,
                hasDiscount: true,
                maxDiscountPercent: 50,
            })
        })

        it('ignores inactive variants', async () => {
            const p = await product([{price: 1000}, {size: '41', price: 100, isActive: false}])

            expect(await pricingOf(p.id)).toEqual(NO_DISCOUNT(1000, 1000))
        })

        it('applies only the best of several discounts (no stacking)', async () => {
            const p = await product([{price: 1000}])
            await discounts.create({value: 10, scope: scope('product', p.id)})
            await discounts.create({value: 30, scope: scope('product', p.id)})

            expect(await pricingOf(p.id)).toMatchObject({finalMinPrice: 700, maxDiscountPercent: 30})
        })

        it('applies category, brand and product scoped discounts to the matching products only', async () => {
            const [category, brand] = [await createCategory(admin), await createBrand(admin)]
            const byCategory = await product([{price: 1000}], {categoryId: category.id})
            const byBrand = await product([{price: 1000}], {brandId: brand.id})
            const untouched = await product([{price: 1000}])
            await discounts.create({value: 10, scope: scope('category', category.id)})
            await discounts.create({value: 20, scope: scope('brand', brand.id)})

            expect((await pricingOf(byCategory.id)).finalMinPrice).toBe(900)
            expect((await pricingOf(byBrand.id)).finalMinPrice).toBe(800)
            expect(await pricingOf(untouched.id)).toEqual(NO_DISCOUNT(1000, 1000))
        })

        it('ignores inactive, future and expired discounts', async () => {
            const p = await product([{price: 1000}])
            await discounts.create({value: 50, isActive: false, scope: scope('product', p.id)})
            await discounts.create({value: 50, startsAt: isoFromNow(DAY), scope: scope('product', p.id)})
            await discounts.create({
                value: 50,
                startsAt: isoFromNow(-2 * DAY),
                endsAt: isoFromNow(-DAY),
                scope: scope('product', p.id)
            })

            expect(await pricingOf(p.id)).toEqual(NO_DISCOUNT(1000, 1000))
        })

        it('follows discount edits, deactivation and deletion on the next request', async () => {
            const p = await product([{price: 1000}])
            const d = await discounts.create({value: 10, scope: scope('product', p.id)})
            expect((await pricingOf(p.id)).finalMinPrice).toBe(900)

            await admin.patch(`/admin/discounts/${d.id}`, {value: 40})
            expect((await pricingOf(p.id)).finalMinPrice).toBe(600)

            await admin.patch(`/admin/discounts/${d.id}`, {isActive: false})
            expect((await pricingOf(p.id)).hasDiscount).toBe(false)

            await admin.patch(`/admin/discounts/${d.id}`, {isActive: true})
            await admin.delete(`/admin/discounts/${d.id}`)
            expect((await pricingOf(p.id)).hasDiscount).toBe(false)
        })

        it('follows catalog price changes together with the discount', async () => {
            const p = await product([{price: 1000}])
            await discounts.create({value: 10, scope: scope('product', p.id)})

            await changeVariant(ctx.app, p.variants[0], {price: 2000})

            expect(await pricingOf(p.id)).toMatchObject({minPrice: 2000, finalMinPrice: 1800})
        })
    })

    describe('newest tag', () => {
        it('tags a freshly published product and drops the tag after 14 days', async () => {
            const p = await product([{}])
            expect((await metaOf(p.id)).tags).toEqual(['newest'])

            // the use case is called directly: an HTTP call 14 days "later" would hit an expired session
            const tagsAt = (ms: number) => withNowPlus(ms, async () => (await getById.execute(p.id)).meta.tags)

            expect(await tagsAt(13 * DAY + 23 * HOUR)).toEqual(['newest'])
            expect(await tagsAt(14 * DAY + HOUR)).toEqual([])
        })
    })

    describe('best_seller and popular tags (stats pushed by the insights module)', () => {
        const stat = (productId: string, unitsSold: number, favoritesAdded: number) => ({
            productId,
            unitsSold,
            favoritesAdded
        })
        const tagsOf = async (id: string) => ((await metaOf(id)).tags as string[]).filter((t) => t !== 'newest')

        it('flags products above the minimums and reports the counts', async () => {
            const [seller, loved, both, weak] = [
                await product([{}]), await product([{}]), await product([{}]), await product([{}]),
            ]

            const result = await replaceStats.execute({
                items: [stat(seller.id, 5, 0), stat(loved.id, 0, 4), stat(both.id, 3, 3), stat(weak.id, 2, 2)],
            })

            expect(result).toEqual({total: 4, bestSellers: 2, popular: 2})
            expect(await tagsOf(seller.id)).toEqual(['best_seller'])
            expect(await tagsOf(loved.id)).toEqual(['popular'])
            expect(await tagsOf(both.id)).toEqual(['best_seller', 'popular']) // fixed order
            expect(await tagsOf(weak.id)).toEqual([]) // 2 is below the minimum of 3
        })

        it('keeps the order newest, best_seller, popular', async () => {
            const p = await product([{}])

            await replaceStats.execute({items: [stat(p.id, 9, 9)]})

            expect((await metaOf(p.id)).tags).toEqual(['newest', 'best_seller', 'popular'])
        })

        it('is visible in list, search and detail by slug', async () => {
            const p = await product([{}], {name: `Stats visible ${randomId().slice(0, 8)}`})
            await replaceStats.execute({items: [stat(p.id, 6, 0)]})

            const listed = (await anonymous.get(`/products${qs({pageSize: 100})}`)).json().data.items.find((i: any) => i.id === p.id)
            const searched = (await anonymous.get(`/products/search${qs({q: p.name})}`)).json().data.items[0]
            const bySlug = (await anonymous.get(`/products/slug/${p.slug}`)).json().data

            for (const item of [listed, searched, bySlug]) expect(item.meta.tags).toContain('best_seller')
        })

        it('replaces the whole snapshot on every push', async () => {
            const [a, b] = [await product([{}]), await product([{}])]
            await replaceStats.execute({items: [stat(a.id, 5, 5)]})
            expect(await tagsOf(a.id)).toEqual(['best_seller', 'popular'])

            await replaceStats.execute({items: [stat(b.id, 5, 0)]})
            expect(await tagsOf(a.id)).toEqual([])
            expect(await tagsOf(b.id)).toEqual(['best_seller'])

            await replaceStats.execute({items: []})
            expect(await tagsOf(b.id)).toEqual([])
        })

        it('silently ignores unknown product ids', async () => {
            const p = await product([{}])

            await expect(replaceStats.execute({items: [stat(randomId(), 10, 10), stat(p.id, 3, 0)]})).resolves.toBeDefined()

            expect(await tagsOf(p.id)).toEqual(['best_seller'])
        })

        describe('top 10 rule (11 products)', () => {
            let ids: string[]

            beforeAll(async () => {
                const category = await createCategory(admin)
                ids = []
                for (let i = 0; i < 11; i++) ids.push((await product([{}], {categoryId: category.id})).id)
            })

            it('flags only the 10 best sellers, ranked by units sold', async () => {
                // units 3..13: the first product (3 units) is the 11th and misses the cut
                const result = await replaceStats.execute({items: ids.map((id, i) => stat(id, i + 3, 0))})

                expect(result).toMatchObject({bestSellers: 10, popular: 0})
                expect(await tagsOf(ids[0])).toEqual([])
                for (const id of ids.slice(1)) expect(await tagsOf(id)).toEqual(['best_seller'])
            })

            it('flags only the 10 most favorited products', async () => {
                const result = await replaceStats.execute({items: ids.map((id, i) => stat(id, 0, i + 3))})

                expect(result).toMatchObject({bestSellers: 0, popular: 10})
                expect(await tagsOf(ids[0])).toEqual([])
                for (const id of ids.slice(1)) expect(await tagsOf(id)).toEqual(['popular'])
            })

            it('breaks ties deterministically: the lowest product ids win', async () => {
                const sorted = [...ids].sort((a, b) => a.localeCompare(b))

                await replaceStats.execute({items: ids.map((id) => stat(id, 5, 5))})

                for (const id of sorted.slice(0, 10)) expect(await tagsOf(id)).toEqual(['best_seller', 'popular'])
                expect(await tagsOf(sorted[10])).toEqual([])
            })

            it('flags fewer than 10 when fewer products reach the minimum', async () => {
                const result = await replaceStats.execute({
                    items: ids.map((id, i) => stat(id, i < 4 ? 3 : 2, 0)),
                })

                expect(result.bestSellers).toBe(4)
            })
        })
    })
})