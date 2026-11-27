import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {IReplaceProductStats, IUpsertProductRating} from '@api/product/application'
import {UserRole} from '@api/users/domain'
import {REPLACE_PRODUCT_STATS, UPSERT_PRODUCT_RATING} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, anonymousApi, createUserSession, expectValidationError, idsOf, qs, walkPages, withNowPlus} from '../../util/test.util'
import {
    createAttribute,
    createCategory,
    createDraftProduct,
    createPublishedProduct,
    opt,
    setAttributes,
    unpublishProduct,
} from './product-test.util'

const DAY = 24 * 60 * 60 * 1000

describe('Storefront filters: specs, rating, tags (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    let upsertRating: IUpsertProductRating
    let replaceStats: IReplaceProductStats
    let catA: any
    let catB: any
    let country: any
    let season: any
    let handmade: any
    let p: Record<'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'draft', string>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        anonymous = anonymousApi(ctx.app)
        upsertRating = ctx.app.get<IUpsertProductRating>(UPSERT_PRODUCT_RATING, {strict: false})
        replaceStats = ctx.app.get<IReplaceProductStats>(REPLACE_PRODUCT_STATS, {strict: false})
        ;[catA, catB] = [await createCategory(admin), await createCategory(admin)]

        country = await createAttribute(admin, {key: 'country', name: 'A Country', type: 'select', isFilterable: true, position: 1, options: [opt('ir', 'Iran'), opt('tr', 'Turkey'), opt('it', 'Italy')]})
        season = await createAttribute(admin, {key: 'season', name: 'B Season', type: 'multi_select', isFilterable: true, position: 2, options: [opt('winter', 'Winter'), opt('summer', 'Summer'), opt('fall', 'Fall')]})
        handmade = await createAttribute(admin, {key: 'handmade', name: 'C Handmade', type: 'boolean', isFilterable: true, position: 3})

        await createAttribute(admin, {key: 'note', name: 'Note', type: 'text', position: 4})
        await createAttribute(admin, {key: 'weight', name: 'Weight', type: 'number', isFilterable: true, position: 5})
        await createAttribute(admin, {key: 'secret', name: 'Secret', type: 'select', isFilterable: false, position: 6, options: [opt('x', 'X')]})

        const mk = (categoryId: string, name: string) => createPublishedProduct(ctx.app, admin, {categoryId, name, variants: [{price: 1000, stock: 100}]})
        const [p1, p2, p3, p4, p5] = [await mk(catA.id, 'Filter P1'), await mk(catA.id, 'Filter P2'), await mk(catB.id, 'Filter P3'), await mk(catB.id, 'Filter P4'), await mk(catB.id, 'Filter P5')]
        const draft = await createDraftProduct(ctx.app, admin, [{}], {categoryId: catA.id})
        p = {p1: p1.id, p2: p2.id, p3: p3.id, p4: p4.id, p5: p5.id, draft: draft.id}

        const set = (id: string, values: {key: string; value: unknown}[]) => setAttributes(admin, id, values).then((r) => expect(r.statusCode).toBe(200))
        await set(p.p1, [{key: 'country', value: 'ir'}, {key: 'season', value: ['winter', 'fall']}, {key: 'handmade', value: true}, {key: 'secret', value: 'x'}, {key: 'note', value: 'hello'}, {key: 'weight', value: 5}])
        await set(p.p2, [{key: 'country', value: 'tr'}, {key: 'season', value: ['summer']}, {key: 'handmade', value: false}])
        await set(p.p3, [{key: 'country', value: 'ir'}, {key: 'season', value: ['summer']}])
        await set(p.p4, [{key: 'country', value: 'it'}])
        await set(p.draft, [{key: 'country', value: 'ir'}])

        // ratings: p1 4.8 (10), p2 4.0 (3), p3 4.0 (20), p4 3.2 (5), p5 none
        await upsertRating.execute({productId: p.p1, average: 4.8, count: 10})
        await upsertRating.execute({productId: p.p2, average: 4, count: 3})
        await upsertRating.execute({productId: p.p3, average: 4, count: 20})
        await upsertRating.execute({productId: p.p4, average: 3.2, count: 5})
    })

    afterEach(async () => {
        await replaceStats.execute({items: []})
    })

    const all = () => [p.p1, p.p2, p.p3, p.p4, p.p5]
    const list = async (params: Record<string, any> = {}, path = '/products') => {
        const res = await anonymous.get(`${path}${qs({pageSize: 100, ...params})}`)
        expect(res.statusCode).toBe(200)
        return res.json().data.items as any[]
    }
    const ids = async (params: Record<string, any> = {}) => (await list(params)).map((i) => i.id).sort()
    const sorted = (...x: string[]) => [...x].sort()
    const byIdDesc = (...x: string[]) => [...x].sort((a, b) => b.localeCompare(a))
    const byIdAsc = (...x: string[]) => [...x].sort((a, b) => a.localeCompare(b))

    describe('specs (product attributes)', () => {
        it.each([
            ['a select value', 'country:ir', ['p1', 'p3']],
            ['any of several values of one attribute', 'country:ir,tr', ['p1', 'p2', 'p3']],
            ['a multi-select value', 'season:summer', ['p2', 'p3']],
            ['any of several multi-select values', 'season:winter,summer', ['p1', 'p2', 'p3']],
            ['all attributes at once (AND)', 'country:ir;season:summer', ['p3']],
            ['three attributes at once', 'country:ir;season:winter;handmade:true', ['p1']],
            ['a boolean true', 'handmade:true', ['p1']],
            ['a boolean false (a product without a value does not match)', 'handmade:false', ['p2']],
            ['a boolean written in capitals', 'handmade:TRUE', ['p1']],
            ['an attribute key in capitals', 'COUNTRY:ir', ['p1', 'p3']],
            ['a value that no product has', 'country:zz', []],
            ['a combination nothing matches', 'country:it;season:winter', []],
        ] as [string, string, string[]][])('matches %s (%s)', async (_label, specs, expected) => {
            expect(await ids({specs})).toEqual(sorted(...expected.map((k) => (p as any)[k])))
        })

        it('never returns drafts or unpublished products', async () => {
            expect(await ids({specs: 'country:ir'})).not.toContain(p.draft)
            const extra = await createPublishedProduct(ctx.app, admin, {categoryId: catA.id, variants: [{}]})
            await setAttributes(admin, extra.id, [{key: 'country', value: 'ir'}])
            expect(await ids({specs: 'country:ir'})).toContain(extra.id)

            await unpublishProduct(admin, extra.id)

            expect(await ids({specs: 'country:ir'})).not.toContain(extra.id)
        })

        it('matches nothing for attributes that are not filterable or not choice/yes-no types', async () => {
            // note: the guide says such keys are "ignored", the code makes them match no product
            expect(await ids({specs: 'secret:x'})).toEqual([])
            expect(await ids({specs: 'note:hello'})).toEqual([])
            expect(await ids({specs: 'weight:5'})).toEqual([])
            expect(await ids({specs: 'no_such_key:1'})).toEqual([])
        })

        it('ignores an attribute written without values, and an empty specs parameter', async () => {
            expect(await ids({specs: 'country:'})).toEqual(sorted(...all()))
            expect(await ids({specs: ''})).toEqual(sorted(...all()))
        })

        it('follows isFilterable: switching it off stops the filter, on brings it back', async () => {
            await admin.patch(`/admin/attributes/${handmade.id}`, {isFilterable: false})
            expect(await ids({specs: 'handmade:true'})).toEqual([])

            await admin.patch(`/admin/attributes/${handmade.id}`, {isFilterable: true})
            expect(await ids({specs: 'handmade:true'})).toEqual([p.p1])
        })

        it('combines with the other filters, with search, and stays independent of the variant "attributes" filter', async () => {
            expect(await ids({specs: 'country:ir', categoryId: catA.id})).toEqual([p.p1])
            expect(await ids({specs: 'country:ir', minRating: 4.1})).toEqual([])
            const searched = await list({specs: 'country:ir', q: 'Filter'}, '/products/search')
            expect(searched.map((i) => i.id).sort()).toEqual(sorted(p.p1, p.p3))
            expect(await ids({specs: 'country:ir', attributes: 'size:42'})).toEqual(sorted(p.p1, p.p3)) // variants: size 42 black
            expect(await ids({specs: 'country:ir', attributes: 'size:99'})).toEqual([])
        })

        it('paginates with a cursor', async () => {
            const pages = await walkPages(anonymous, '/products', {specs: 'country:ir,tr,it', pageSize: 2})

            expect(pages.flatMap((pg) => idsOf(pg.items)).sort()).toEqual(sorted(p.p1, p.p2, p.p3, p.p4))
        })

        it('rejects a specs parameter over 500 characters', async () => {
            expectValidationError(await anonymous.get(`/products${qs({specs: `country:${'a'.repeat(500)}`})}`))
        })
    })

    describe('minRating', () => {
        it.each([
            [1, ['p1', 'p2', 'p3', 'p4']],
            [4, ['p1', 'p2', 'p3']],
            [5, []],
        ])('minRating=%d returns %j (unrated products count as 0)', async (minRating, expected) => {
            expect(await ids({minRating})).toEqual(sorted(...expected.map((k) => (p as any)[k])))
        })

        it('works in search and together with specs', async () => {
            expect((await list({minRating: 4, q: 'Filter'}, '/products/search')).map((i) => i.id).sort()).toEqual(sorted(p.p1, p.p2, p.p3))
            expect(await ids({minRating: 4, specs: 'country:ir'})).toEqual(sorted(p.p1, p.p3))
        })

        it.each([[0], [6], [1.5], ['abc'], [-1]])('rejects minRating=%p', async (value) => {
            expectValidationError(await anonymous.get(`/products${qs({minRating: value})}`))
        })
    })

    describe('sorting by rating and review count', () => {
        const order = async (sort: string) => idsOf(await list({sort}))

        it('sorts by average rating, highest first, with ties by id and unrated products last', async () => {
            expect(await order('rating:desc')).toEqual([p.p1, ...byIdDesc(p.p2, p.p3), p.p4, p.p5])
        })

        it('sorts by average rating, lowest first (unrated products come first)', async () => {
            expect(await order('rating:asc')).toEqual([p.p5, p.p4, ...byIdAsc(p.p2, p.p3), p.p1])
        })

        it('sorts by review count both ways', async () => {
            expect(await order('reviewCount:desc')).toEqual([p.p3, p.p1, p.p4, p.p2, p.p5])
            expect(await order('reviewCount:asc')).toEqual([p.p5, p.p2, p.p4, p.p1, p.p3])
        })

        it.each(['rating:desc', 'rating:asc', 'reviewCount:desc', 'reviewCount:asc'])('walks %s page by page without gaps or duplicates', async (sort) => {
            const full = await order(sort)

            const pages = await walkPages(anonymous, '/products', {sort, pageSize: 2})

            expect(pages.flatMap((pg) => idsOf(pg.items))).toEqual(full)
        })

        it('keeps the earlier sort fields working and still ignores unknown ones', async () => {
            expect((await order('createdAt:asc'))).toEqual([p.p1, p.p2, p.p3, p.p4, p.p5])
            expect((await order('colour:asc'))).toHaveLength(5)
        })

        it('applies to search results too', async () => {
            const found = await list({sort: 'rating:desc', q: 'Filter'}, '/products/search')

            expect(idsOf(found)).toEqual([p.p1, ...byIdDesc(p.p2, p.p3), p.p4, p.p5])
        })
    })

    describe('tag filter', () => {
        const stat = (productId: string, unitsSold: number, favoritesAdded: number) => ({productId, unitsSold, favoritesAdded})

        it('newest: products published within 14 days, using the same window as the badge', async () => {
            expect(await ids({tag: 'newest'})).toEqual(sorted(...all()))

            expect(await withNowPlus(13 * DAY, async () => idsOf(await list({tag: 'newest'})))).toHaveLength(5)
            expect(await withNowPlus(15 * DAY, async () => idsOf(await list({tag: 'newest'})))).toEqual([])
        })

        it('best_seller and popular follow the stats, and an empty snapshot clears them', async () => {
            await replaceStats.execute({items: [stat(p.p1, 5, 0), stat(p.p2, 0, 4), stat(p.p3, 3, 3)]})

            expect(await ids({tag: 'best_seller'})).toEqual(sorted(p.p1, p.p3))
            expect(await ids({tag: 'popular'})).toEqual(sorted(p.p2, p.p3))

            await replaceStats.execute({items: []})
            expect(await ids({tag: 'best_seller'})).toEqual([])
            expect(await ids({tag: 'popular'})).toEqual([])
        })

        it('agrees with the badge: every returned product carries the tag', async () => {
            await replaceStats.execute({items: [stat(p.p1, 5, 0), stat(p.p3, 3, 3)]})

            const items = await list({tag: 'best_seller'})

            expect(items).toHaveLength(2)
            for (const item of items) expect(item.meta.tags).toContain('best_seller')
        })

        it('combines with other filters', async () => {
            await replaceStats.execute({items: [stat(p.p1, 5, 0), stat(p.p3, 3, 3)]})

            expect(await ids({tag: 'best_seller', specs: 'country:ir', minRating: 4.5})).toEqual([p.p1])
            expect(await ids({tag: 'best_seller', categoryId: catB.id})).toEqual([p.p3])
        })

        it.each([['hot'], ['NEWEST'], ['']])('rejects the tag %p', async (tag) => {
            expectValidationError(await anonymous.get(`/products${qs({tag})}`))
        })
    })

    describe('GET /products/filters: the specs facet', () => {
        const facet = async (params: Record<string, any> = {}) => {
            const res = await anonymous.get(`/products/filters${qs(params)}`)
            expect(res.statusCode).toBe(200)
            return res.json().data.specs as any[]
        }

        it('offers only filterable select, multi-select and yes/no attributes, in position order', async () => {
            const specs = await facet()

            expect(specs.map((s) => s.key)).toEqual(['country', 'season', 'handmade'])
            expect(specs[0]).toMatchObject({key: 'country', name: 'A Country', type: 'select', unit: null})
            expect(specs[1]).toMatchObject({type: 'multi_select'})
            expect(specs[2]).toMatchObject({type: 'boolean'})
        })

        it('counts distinct published products per option, ordered like the admin arranged them', async () => {
            const specs = await facet()

            expect(specs[0].options).toEqual([
                {value: 'ir', label: 'Iran', count: 2}, // p1 and p3, the draft is not counted
                {value: 'tr', label: 'Turkey', count: 1},
                {value: 'it', label: 'Italy', count: 1},
            ])
            expect(specs[1].options).toEqual([
                {value: 'winter', label: 'Winter', count: 1},
                {value: 'summer', label: 'Summer', count: 2},
                {value: 'fall', label: 'Fall', count: 1},
            ])
            expect(specs[2].options).toEqual([
                {value: 'false', label: null, count: 1},
                {value: 'true', label: null, count: 1},
            ])
        })

        it('only lists options that products actually have', async () => {
            const lonely = await createAttribute(admin, {key: 'origin', name: 'D Origin', type: 'select', isFilterable: true, position: 9, options: [opt('a'), opt('b')]})
            const product = await createPublishedProduct(ctx.app, admin, {categoryId: catA.id, variants: [{}]})
            await setAttributes(admin, product.id, [{key: 'origin', value: 'a'}])

            const origin = (await facet()).find((s) => s.key === 'origin')

            expect(origin.options).toEqual([{value: 'a', label: 'a', count: 1}])
            await unpublishProduct(admin, product.id)
            expect((await facet()).find((s) => s.key === 'origin')).toBeUndefined()
            await admin.delete(`/admin/attributes/${lonely.id}`)
        })

        it('is scoped to a category (and its children)', async () => {
            const specs = await facet({categoryId: catA.id})

            expect(specs.find((s) => s.key === 'country').options).toEqual([
                {value: 'ir', label: 'Iran', count: 1},
                {value: 'tr', label: 'Turkey', count: 1},
            ])
        })

        it('hides an attribute that is switched to not filterable', async () => {
            await admin.patch(`/admin/attributes/${season.id}`, {isFilterable: false})
            expect((await facet()).map((s) => s.key)).toEqual(['country', 'handmade'])

            await admin.patch(`/admin/attributes/${season.id}`, {isFilterable: true})
            expect((await facet()).map((s) => s.key)).toEqual(['country', 'season', 'handmade'])
        })

        it('uses option labels as they are after an edit', async () => {
            await admin.patch(`/admin/attributes/${country.id}`, {
                options: country.options.map((o: any) => ({id: o.id, value: o.value, label: o.value === 'ir' ? 'Persia' : o.label})),
            })

            expect((await facet())[0].options[0]).toMatchObject({value: 'ir', label: 'Persia'})
        })

        it('round-trips: filtering by an offered option returns exactly the counted products', async () => {
            for (const spec of await facet()) {
                for (const option of spec.options) {
                    const found = await ids({specs: `${spec.key}:${option.value}`})
                    expect(found).toHaveLength(option.count)
                }
            }
        })

        it('is an empty list on an empty catalog or a category without products', async () => {
            const empty = await createCategory(admin)

            expect(await facet({categoryId: empty.id})).toEqual([])
        })
    })
})
