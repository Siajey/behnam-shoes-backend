import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    sleep,
    slug,
    uid,
} from '../../../util/test.util'
import {
    createCategory,
    createProduct,
} from './product-test.util'

describe('Admin categories (e2e)', () => {
    let ctx: TestContext
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
    })

    describe('POST /admin/categories', () => {
        it('creates a root category with defaults', async () => {
            const body = {name: `Sneakers ${uid()}`, slug: slug('sneakers')}
            const res = await admin.post('/admin/categories', body)

            expectOk(res, 201, 'CATEGORY_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                name: body.name,
                slug: body.slug,
                parentId: null,
                sortOrder: 0,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it('creates a child category with sortOrder', async () => {
            const parent = await createCategory(admin)

            const res = await admin.post('/admin/categories', {
                name: `Child ${uid()}`,
                slug: slug('child'),
                parentId: parent.id,
                sortOrder: 7,
            })

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({parentId: parent.id, sortOrder: 7})
        })

        it('accepts a null parentId and coerces a numeric string sortOrder', async () => {
            const res = await admin.post('/admin/categories', {
                name: `Coerced ${uid()}`,
                slug: slug('coerced'),
                parentId: null,
                sortOrder: '5',
            })

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({parentId: null, sortOrder: 5})
        })

        it('allows two categories with the same name but different slugs', async () => {
            const name = `Same name ${uid()}`
            expect((await admin.post('/admin/categories', {name, slug: slug('a')})).statusCode).toBe(201)
            expect((await admin.post('/admin/categories', {name, slug: slug('b')})).statusCode).toBe(201)
        })

        it('trims the name and lowercases the slug', async () => {
            const tag = uid()
            const res = await admin.post('/admin/categories', {name: `  Boots ${tag} `, slug: `BOOTS-${tag}`})

            expect(res.json().data).toMatchObject({name: `Boots ${tag}`, slug: `boots-${tag}`})
        })

        it('rejects missing name or slug', async () => {
            expectValidationError(await admin.post('/admin/categories', {slug: slug('x')}))
            expectValidationError(await admin.post('/admin/categories', {name: `X ${uid()}`}))
        })

        it('rejects a name over 120 chars and a slug over 150 chars', async () => {
            expectValidationError(await admin.post('/admin/categories', {name: 'a'.repeat(121), slug: slug('x')}))
            expectValidationError(await admin.post('/admin/categories', {name: `X ${uid()}`, slug: 'a'.repeat(151)}))
        })

        it.each(['has space', '-leading', 'trailing-', 'double--dash', 'under_score', ''])(
            'rejects the invalid slug %p',
            async (badSlug) => {
                expectValidationError(await admin.post('/admin/categories', {name: `X ${uid()}`, slug: badSlug}))
            },
        )

        it.each([-1, 10001, 1.5, 'abc'])('rejects the invalid sortOrder %p', async (sortOrder) => {
            expectValidationError(
                await admin.post('/admin/categories', {name: `X ${uid()}`, slug: slug('x'), sortOrder}),
            )
        })

        it('rejects a malformed parentId', async () => {
            expectValidationError(
                await admin.post('/admin/categories', {name: `X ${uid()}`, slug: slug('x'), parentId: 'nope'}),
            )
        })

        it('rejects an unknown parent', async () => {
            const res = await admin.post('/admin/categories', {
                name: `X ${uid()}`,
                slug: slug('x'),
                parentId: randomId(),
            })

            expectError(res, 404, 'CATEGORY_NOT_FOUND')
        })

        it('rejects a duplicate slug (case-insensitive)', async () => {
            const taken = slug('taken')
            await createCategory(admin, {slug: taken})

            const res = await admin.post('/admin/categories', {name: `Other ${uid()}`, slug: taken.toUpperCase()})

            expectError(res, 409, 'CATEGORY_SLUG_ALREADY_EXISTS')
        })
    })

    describe('GET /admin/categories', () => {
        it('returns a flat list ordered by sortOrder then name', async () => {
            const tag = uid()
            const c = await createCategory(admin, {name: `${tag} C`, sortOrder: 1})
            const b = await createCategory(admin, {name: `${tag} B`, sortOrder: 1})
            const a = await createCategory(admin, {name: `${tag} A`, sortOrder: 2})
            const first = await createCategory(admin, {name: `${tag} Z`, sortOrder: 0})

            const res = await admin.get('/admin/categories')

            expectOk(res, 200, 'CATEGORY_LIST_SUCCESS')
            const mine = (res.json().data as any[]).filter((x) => x.name.startsWith(tag))
            expect(mine.map((x) => x.id)).toEqual([first.id, b.id, c.id, a.id])
            expect(mine[0]).toEqual({
                id: first.id,
                name: `${tag} Z`,
                slug: first.slug,
                parentId: null,
                sortOrder: 0,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })
    })

    describe('PATCH /admin/categories/:id', () => {
        it('updates name, slug and sortOrder', async () => {
            const category = await createCategory(admin)
            const body = {name: `Renamed ${uid()}`, slug: slug('renamed'), sortOrder: 9}

            const res = await admin.patch(`/admin/categories/${category.id}`, body)

            expectOk(res, 200, 'CATEGORY_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject(body)
        })

        it('moves a category under a parent and back to the root', async () => {
            const parent = await createCategory(admin)
            const child = await createCategory(admin)

            const moved = await admin.patch(`/admin/categories/${child.id}`, {parentId: parent.id})
            expect(moved.statusCode).toBe(200)
            expect(moved.json().data.parentId).toBe(parent.id)

            const root = await admin.patch(`/admin/categories/${child.id}`, {parentId: null})
            expect(root.statusCode).toBe(200)
            expect(root.json().data.parentId).toBeNull()
        })

        it('allows re-sending the own slug and the unchanged parent', async () => {
            const parent = await createCategory(admin)
            const child = await createCategory(admin, {parentId: parent.id})

            const res = await admin.patch(`/admin/categories/${child.id}`, {
                slug: child.slug,
                parentId: parent.id,
                name: `Same ${uid()}`,
            })

            expect(res.statusCode).toBe(200)
        })

        it('rejects a slug that belongs to another category', async () => {
            const other = await createCategory(admin)
            const category = await createCategory(admin)

            const res = await admin.patch(`/admin/categories/${category.id}`, {slug: other.slug})

            expectError(res, 409, 'CATEGORY_SLUG_ALREADY_EXISTS')
        })

        it('rejects making a category its own parent', async () => {
            const category = await createCategory(admin)

            const res = await admin.patch(`/admin/categories/${category.id}`, {parentId: category.id})

            expectError(res, 400, 'CATEGORY_CIRCULAR_PARENT')
        })

        it('rejects moving a category under one of its descendants', async () => {
            const a = await createCategory(admin)
            const b = await createCategory(admin, {parentId: a.id})
            const c = await createCategory(admin, {parentId: b.id})

            expectError(await admin.patch(`/admin/categories/${a.id}`, {parentId: c.id}), 400, 'CATEGORY_CIRCULAR_PARENT')
            expectError(await admin.patch(`/admin/categories/${a.id}`, {parentId: b.id}), 400, 'CATEGORY_CIRCULAR_PARENT')

            const list = await admin.get('/admin/categories')
            const stored = (list.json().data as any[]).find((x) => x.id === a.id)
            expect(stored.parentId).toBeNull()
        })

        it('rejects an unknown parent', async () => {
            const category = await createCategory(admin)

            expectError(
                await admin.patch(`/admin/categories/${category.id}`, {parentId: randomId()}),
                404,
                'CATEGORY_NOT_FOUND',
            )
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const category = await createCategory(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/categories/${category.id}`, {sortOrder: 3})

            expect(res.json().data.createdAt).toBe(category.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(
                new Date(category.updatedAt).getTime(),
            )
        })

        it('rejects an empty body and invalid values', async () => {
            const category = await createCategory(admin)

            expectValidationError(await admin.patch(`/admin/categories/${category.id}`, {}))
            expectValidationError(await admin.patch(`/admin/categories/${category.id}`, {name: ''}))
            expectValidationError(await admin.patch(`/admin/categories/${category.id}`, {sortOrder: -1}))
            expectValidationError(await admin.patch(`/admin/categories/${category.id}`, {parentId: 'nope'}))
        })

        it('returns 404 for an unknown category and 400 for a malformed id', async () => {
            expectError(await admin.patch(`/admin/categories/${randomId()}`, {name: 'x'}), 404, 'CATEGORY_NOT_FOUND')
            expectValidationError(await admin.patch('/admin/categories/not-a-uuid', {name: 'x'}))
        })
    })

    describe('DELETE /admin/categories/:id', () => {
        it('deletes a leaf category without products', async () => {
            const category = await createCategory(admin)

            const res = await admin.delete(`/admin/categories/${category.id}`)

            expectOk(res, 200, 'CATEGORY_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            const list = await admin.get('/admin/categories')
            expect((list.json().data as any[]).some((x) => x.id === category.id)).toBe(false)
        })

        it('returns 404 when deleting twice', async () => {
            const category = await createCategory(admin)
            await admin.delete(`/admin/categories/${category.id}`)

            expectError(await admin.delete(`/admin/categories/${category.id}`), 404, 'CATEGORY_NOT_FOUND')
        })

        it('refuses to delete a category that has children, then allows it once they are gone', async () => {
            const parent = await createCategory(admin)
            const child = await createCategory(admin, {parentId: parent.id})

            expectError(await admin.delete(`/admin/categories/${parent.id}`), 409, 'CATEGORY_HAS_CHILDREN')

            expect((await admin.delete(`/admin/categories/${child.id}`)).statusCode).toBe(200)
            expect((await admin.delete(`/admin/categories/${parent.id}`)).statusCode).toBe(200)
        })

        it('refuses to delete a category that still has products', async () => {
            const category = await createCategory(admin)
            const product = await createProduct(admin, {categoryId: category.id})

            expectError(await admin.delete(`/admin/categories/${category.id}`), 409, 'CATEGORY_HAS_PRODUCTS')

            await admin.patch(`/admin/products/${product.id}`, {categoryId: null})
            expect((await admin.delete(`/admin/categories/${category.id}`)).statusCode).toBe(200)
        })

        it('reports CATEGORY_HAS_CHILDREN first when both children and products exist', async () => {
            const parent = await createCategory(admin)
            await createCategory(admin, {parentId: parent.id})
            await createProduct(admin, {categoryId: parent.id})

            expectError(await admin.delete(`/admin/categories/${parent.id}`), 409, 'CATEGORY_HAS_CHILDREN')
        })

        it('returns 400 for a malformed id', async () => {
            expectValidationError(await admin.delete('/admin/categories/not-a-uuid'))
        })
    })
})
