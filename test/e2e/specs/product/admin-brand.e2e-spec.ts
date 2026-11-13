import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    AR_NAME,
    AR_SLUG,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    FA_NAME,
    FA_SLUG,
    randomId,
    sleep,
    slug,
    uid,
} from '../../../util/test.util'
import {
    createBrand,
    createProduct,
} from './product-test.util'

describe('Admin brands (e2e)', () => {
    let ctx: TestContext
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
    })

    describe('POST /admin/brands', () => {
        it('creates a brand and returns the admin shape', async () => {
            const body = {name: `Nike ${uid()}`, slug: slug('nike')}
            const res = await admin.post('/admin/brands', body)

            expectOk(res, 201, 'BRAND_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                name: body.name,
                slug: body.slug,
                logoKey: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it('stores the logoKey when provided', async () => {
            const res = await admin.post('/admin/brands', {
                name: `Adidas ${uid()}`,
                slug: slug('adidas'),
                logoKey: 'brands/adidas.png',
            })

            expect(res.statusCode).toBe(201)
            expect(res.json().data.logoKey).toBe('brands/adidas.png')
        })

        it('accepts a null logoKey', async () => {
            const res = await admin.post('/admin/brands', {name: `Puma ${uid()}`, slug: slug('puma'), logoKey: null})

            expect(res.statusCode).toBe(201)
            expect(res.json().data.logoKey).toBeNull()
        })

        it('trims the name and lowercases the slug', async () => {
            const tag = uid()
            const res = await admin.post('/admin/brands', {name: `  Reebok ${tag}  `, slug: `Reebok-${tag}`.toUpperCase()})

            expect(res.statusCode).toBe(201)
            expect(res.json().data.name).toBe(`Reebok ${tag}`)
            expect(res.json().data.slug).toBe(`reebok-${tag}`)
        })

        it('normalises Arabic kaf/yeh to Persian in name and slug', async () => {
            const res = await admin.post('/admin/brands', {name: AR_NAME, slug: AR_SLUG})

            expect(res.statusCode).toBe(201)
            expect(res.json().data.name).toBe(FA_NAME)
            expect(res.json().data.slug).toBe(FA_SLUG)
        })

        it('rejects a missing name', async () => {
            expectValidationError(await admin.post('/admin/brands', {slug: slug('x')}))
        })

        it('rejects a missing slug', async () => {
            expectValidationError(await admin.post('/admin/brands', {name: `X ${uid()}`}))
        })

        it('rejects a whitespace-only name', async () => {
            expectValidationError(await admin.post('/admin/brands', {name: '   ', slug: slug('x')}))
        })

        it('rejects a name longer than 120 characters', async () => {
            expectValidationError(await admin.post('/admin/brands', {name: 'a'.repeat(121), slug: slug('x')}))
        })

        it('rejects a slug longer than 150 characters', async () => {
            expectValidationError(await admin.post('/admin/brands', {name: `X ${uid()}`, slug: 'a'.repeat(151)}))
        })

        it.each(['has space', '-leading', 'trailing-', 'double--dash', 'under_score', 'sp@ce', ''])(
            'rejects the invalid slug %p',
            async (badSlug) => {
                expectValidationError(await admin.post('/admin/brands', {name: `X ${uid()}`, slug: badSlug}))
            },
        )

        it('rejects an empty or too long logoKey', async () => {
            expectValidationError(
                await admin.post('/admin/brands', {name: `X ${uid()}`, slug: slug('x'), logoKey: ''}),
            )
            expectValidationError(
                await admin.post('/admin/brands', {name: `X ${uid()}`, slug: slug('x'), logoKey: 'k'.repeat(256)}),
            )
        })

        it('rejects a duplicate slug (case-insensitive)', async () => {
            const taken = slug('taken')
            await createBrand(admin, {slug: taken})

            const res = await admin.post('/admin/brands', {name: `Other ${uid()}`, slug: taken.toUpperCase()})

            expectError(res, 409, 'BRAND_SLUG_ALREADY_EXISTS')
        })

        it('rejects a duplicate name (unique index brands_name_uq)', async () => {
            const name = `Unique ${uid()}`
            await createBrand(admin, {name})

            const res = await admin.post('/admin/brands', {name, slug: slug('different')})

            expect(res.statusCode).toBe(409)
        })
    })

    describe('GET /admin/brands', () => {
        it('lists brands ordered by name with the admin shape', async () => {
            const tag = uid()
            const charlie = await createBrand(admin, {name: `${tag} Charlie`})
            const alpha = await createBrand(admin, {name: `${tag} Alpha`})
            const bravo = await createBrand(admin, {name: `${tag} Bravo`, logoKey: 'brands/bravo.png'})

            const res = await admin.get('/admin/brands')

            expectOk(res, 200, 'BRAND_LIST_SUCCESS')
            const mine = (res.json().data as any[]).filter((b) => b.name.startsWith(tag))
            expect(mine.map((b) => b.id)).toEqual([alpha.id, bravo.id, charlie.id])
            expect(mine[1]).toEqual({
                id: bravo.id,
                name: `${tag} Bravo`,
                slug: bravo.slug,
                logoKey: 'brands/bravo.png',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })
    })

    describe('PATCH /admin/brands/:id', () => {
        it('updates the name', async () => {
            const brand = await createBrand(admin)
            const name = `Renamed ${uid()}`

            const res = await admin.patch(`/admin/brands/${brand.id}`, {name})

            expectOk(res, 200, 'BRAND_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject({id: brand.id, name, slug: brand.slug})
        })

        it('updates the slug', async () => {
            const brand = await createBrand(admin)
            const newSlug = slug('renamed')

            const res = await admin.patch(`/admin/brands/${brand.id}`, {slug: newSlug})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.slug).toBe(newSlug)
        })

        it('sets and clears the logoKey', async () => {
            const brand = await createBrand(admin)

            const set = await admin.patch(`/admin/brands/${brand.id}`, {logoKey: 'brands/new.png'})
            expect(set.json().data.logoKey).toBe('brands/new.png')

            const cleared = await admin.patch(`/admin/brands/${brand.id}`, {logoKey: null})
            expect(cleared.statusCode).toBe(200)
            expect(cleared.json().data.logoKey).toBeNull()
        })

        it('allows re-sending the brand\'s own slug', async () => {
            const brand = await createBrand(admin)

            const res = await admin.patch(`/admin/brands/${brand.id}`, {slug: brand.slug, name: `Same ${uid()}`})

            expect(res.statusCode).toBe(200)
        })

        it('rejects a slug that belongs to another brand', async () => {
            const other = await createBrand(admin)
            const brand = await createBrand(admin)

            const res = await admin.patch(`/admin/brands/${brand.id}`, {slug: other.slug})

            expectError(res, 409, 'BRAND_SLUG_ALREADY_EXISTS')
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const brand = await createBrand(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/brands/${brand.id}`, {name: `Touched ${uid()}`})

            expect(res.json().data.createdAt).toBe(brand.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(
                new Date(brand.updatedAt).getTime(),
            )
        })

        it('rejects an empty body', async () => {
            const brand = await createBrand(admin)
            expectValidationError(await admin.patch(`/admin/brands/${brand.id}`, {}))
        })

        it('rejects a body that only contains unknown fields', async () => {
            const brand = await createBrand(admin)
            expectValidationError(await admin.patch(`/admin/brands/${brand.id}`, {foo: 'bar'}))
        })

        it('rejects invalid field values', async () => {
            const brand = await createBrand(admin)
            expectValidationError(await admin.patch(`/admin/brands/${brand.id}`, {name: ''}))
            expectValidationError(await admin.patch(`/admin/brands/${brand.id}`, {slug: 'Bad Slug'}))
            expectValidationError(await admin.patch(`/admin/brands/${brand.id}`, {logoKey: ''}))
        })

        it('returns 404 for an unknown brand', async () => {
            expectError(await admin.patch(`/admin/brands/${randomId()}`, {name: 'x'}), 404, 'BRAND_NOT_FOUND')
        })

        it('returns 400 for a malformed id', async () => {
            expectValidationError(await admin.patch('/admin/brands/not-a-uuid', {name: 'x'}))
        })
    })

    describe('DELETE /admin/brands/:id', () => {
        it('deletes a brand', async () => {
            const brand = await createBrand(admin)

            const res = await admin.delete(`/admin/brands/${brand.id}`)

            expectOk(res, 200, 'BRAND_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()

            const list = await admin.get('/admin/brands')
            expect((list.json().data as any[]).some((b) => b.id === brand.id)).toBe(false)
        })

        it('returns 404 when deleting twice', async () => {
            const brand = await createBrand(admin)
            await admin.delete(`/admin/brands/${brand.id}`)

            expectError(await admin.delete(`/admin/brands/${brand.id}`), 404, 'BRAND_NOT_FOUND')
        })

        it('refuses to delete a brand that still has products', async () => {
            const brand = await createBrand(admin)
            const product = await createProduct(admin, {brandId: brand.id})

            expectError(await admin.delete(`/admin/brands/${brand.id}`), 409, 'BRAND_HAS_PRODUCTS')


            const detach = await admin.patch(`/admin/products/${product.id}`, {brandId: null})
            expect(detach.statusCode).toBe(200)
            expectOk(await admin.delete(`/admin/brands/${brand.id}`), 200, 'BRAND_DELETE_SUCCESS')
        })

        it('returns 400 for a malformed id', async () => {
            expectValidationError(await admin.delete('/admin/brands/not-a-uuid'))
        })
    })
})