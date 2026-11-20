import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    slug,
    uid,
} from '../../../util/test.util'
import {cdnUrl, fakeFileStorage} from '../../../util/fake-file-storage'
import {createBrand, createCategory, createPublishedProduct, uploadTaxonomyImage} from './product-test.util'

const MB = 1024 * 1024

describe('Brand and category images (e2e)', () => {
    let ctx: TestContext
    let adminSession: Awaited<ReturnType<typeof createUserSession>>
    let admin: Api
    let anonymous: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        anonymous = anonymousApi(ctx.app)
    })

    const brandBody = (overrides: Record<string, unknown> = {}) => ({name: `Brand ${uid()}`, slug: slug('brand'), ...overrides})
    const categoryBody = (overrides: Record<string, unknown> = {}) => ({name: `Category ${uid()}`, slug: slug('cat'), ...overrides})
    const cover = () => uploadTaxonomyImage(admin, 'brands', {kind: 'cover'})
    const logo = () => uploadTaxonomyImage(admin, 'brands', {kind: 'logo'})
    const catImage = () => uploadTaxonomyImage(admin, 'categories')
    const exists = (key: string) => fakeFileStorage.objects.has(key)

    describe('POST /admin/brands/images/upload-url', () => {
        it.each([
            ['cover', 'brands/covers/'],
            ['logo', 'brands/logos/'],
        ])('returns a presigned target in the %s folder', async (kind, folder) => {
            const res = await admin.post('/admin/brands/images/upload-url', {kind, contentType: 'image/png', sizeBytes: 500})

            expectOk(res, 201, 'BRAND_IMAGE_UPLOAD_URL_SUCCESS')
            const data = res.json().data
            expect(data).toEqual({
                key: expect.stringMatching(new RegExp(`^${folder}\\d{4}/\\d{2}/[0-9a-f-]{36}\\.png$`)),
                uploadUrl: expect.stringContaining(data.key),
                method: 'PUT',
                headers: {'Content-Type': 'image/png', 'Cache-Control': expect.any(String)},
                expiresInSeconds: expect.any(Number),
                publicUrl: cdnUrl(data.key),
            })
        })

        it.each([
            ['cover', 'image/jpeg', 5 * MB, 201],
            ['cover', 'image/webp', 1, 201],
            ['logo', 'image/png', MB, 201],
            ['logo', 'image/webp', 100, 201],
        ])('accepts a %s of %s with %d bytes', async (kind, contentType, sizeBytes, status) => {
            expect((await admin.post('/admin/brands/images/upload-url', {kind, contentType, sizeBytes})).statusCode).toBe(status)
        })

        it('applies the stricter logo policy (no JPEG, at most 1 MB) with FILE_* errors', async () => {
            expectError(await admin.post('/admin/brands/images/upload-url', {kind: 'logo', contentType: 'image/jpeg', sizeBytes: 100}), 400, 'FILE_TYPE_NOT_ALLOWED')
            expectError(await admin.post('/admin/brands/images/upload-url', {kind: 'logo', contentType: 'image/png', sizeBytes: MB + 1}), 400, 'FILE_TOO_LARGE')
        })

        it.each([
            ['a missing kind', {contentType: 'image/png', sizeBytes: 10}],
            ['an unknown kind', {kind: 'banner', contentType: 'image/png', sizeBytes: 10}],
            ['an unsupported content type', {kind: 'cover', contentType: 'image/gif', sizeBytes: 10}],
            ['a missing content type', {kind: 'cover', sizeBytes: 10}],
            ['a zero size', {kind: 'cover', contentType: 'image/png', sizeBytes: 0}],
            ['a size over 5 MB', {kind: 'cover', contentType: 'image/png', sizeBytes: 5 * MB + 1}],
            ['a fractional size', {kind: 'cover', contentType: 'image/png', sizeBytes: 1.5}],
            ['a string size', {kind: 'cover', contentType: 'image/png', sizeBytes: '10'}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await admin.post('/admin/brands/images/upload-url', body))
        })
    })

    describe('POST /admin/categories/images/upload-url', () => {
        it('returns a presigned target in the categories folder', async () => {
            const res = await admin.post('/admin/categories/images/upload-url', {contentType: 'image/webp', sizeBytes: 500})

            expectOk(res, 201, 'CATEGORY_IMAGE_UPLOAD_URL_SUCCESS')
            expect(res.json().data.key).toMatch(/^categories\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/)
            expect(res.json().data.publicUrl).toBe(cdnUrl(res.json().data.key))
        })

        it.each([
            ['image/gif', 10],
            ['image/png', 0],
            ['image/png', 5 * MB + 1],
        ])('rejects %s with %d bytes', async (contentType, sizeBytes) => {
            expectValidationError(await admin.post('/admin/categories/images/upload-url', {contentType, sizeBytes}))
        })
    })

    describe('brands: attaching images', () => {
        it('creates a brand with a cover and a logo and exposes keys and public URLs', async () => {
            const [coverImage, logoImage] = [await cover(), await logo()]

            const res = await admin.post('/admin/brands', brandBody({imageKey: coverImage.key, logoKey: logoImage.key}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({
                imageKey: coverImage.key,
                imageUrl: coverImage.publicUrl,
                logoKey: logoImage.key,
                logoUrl: logoImage.publicUrl,
            })
        })

        it('shows brand images (URLs only, no cover key) on the public list', async () => {
            const [coverImage, logoImage] = [await cover(), await logo()]
            const brand = await admin.post('/admin/brands', brandBody({imageKey: coverImage.key, logoKey: logoImage.key}))

            const item = (await anonymous.get('/brands')).json().data.find((b: any) => b.id === brand.json().data.id)

            expect(item).toEqual({
                id: brand.json().data.id,
                name: brand.json().data.name,
                slug: brand.json().data.slug,
                logoKey: logoImage.key,
                logoUrl: logoImage.publicUrl,
                imageUrl: coverImage.publicUrl,
            })
        })

        it('has no image URLs when none were set', async () => {
            const brand = await createBrand(admin)

            expect(brand).toMatchObject({imageKey: null, imageUrl: null, logoKey: null, logoUrl: null})
        })

        it('sets, replaces and clears images on edit', async () => {
            const brand = await createBrand(admin)
            const [first, second] = [await cover(), await cover()]

            const set = await admin.patch(`/admin/brands/${brand.id}`, {imageKey: first.key})
            expect(set.json().data).toMatchObject({imageKey: first.key, imageUrl: first.publicUrl})

            const replaced = await admin.patch(`/admin/brands/${brand.id}`, {imageKey: second.key})
            expect(replaced.json().data.imageKey).toBe(second.key)
            expect(exists(first.key)).toBe(true) // old files are not removed on replace

            const cleared = await admin.patch(`/admin/brands/${brand.id}`, {imageKey: null})
            expect(cleared.json().data).toMatchObject({imageKey: null, imageUrl: null})
        })

        it('does not re-verify an unchanged key', async () => {
            const image = await cover()
            const brand = (await admin.post('/admin/brands', brandBody({imageKey: image.key}))).json().data
            fakeFileStorage.objects.delete(image.key) // gone from the bucket

            const res = await admin.patch(`/admin/brands/${brand.id}`, {imageKey: image.key, name: `Renamed ${uid()}`})

            expect(res.statusCode).toBe(200)
        })

        it('leaves images untouched when the fields are omitted', async () => {
            const image = await cover()
            const brand = (await admin.post('/admin/brands', brandBody({imageKey: image.key}))).json().data

            const res = await admin.patch(`/admin/brands/${brand.id}`, {name: `Renamed ${uid()}`})

            expect(res.json().data.imageKey).toBe(image.key)
        })

        describe('verification of what was really uploaded', () => {
            it('rejects a key that was never uploaded and creates nothing', async () => {
                const body = brandBody({imageKey: 'brands/covers/2030/01/missing.png'})

                expectError(await admin.post('/admin/brands', body), 404, 'FILE_NOT_FOUND')

                expect((await admin.post('/admin/brands', {...body, imageKey: undefined})).statusCode).toBe(201) // slug still free
            })

            it('rejects a cover key used as the logo and vice versa (wrong folder)', async () => {
                const [coverImage, logoImage] = [await cover(), await logo()]

                expectError(await admin.post('/admin/brands', brandBody({logoKey: coverImage.key})), 404, 'FILE_NOT_FOUND')
                expectError(await admin.post('/admin/brands', brandBody({imageKey: logoImage.key})), 404, 'FILE_NOT_FOUND')
            })

            it('rejects a product or category image as a brand image', async () => {
                const category = await catImage()

                expectError(await admin.post('/admin/brands', brandBody({imageKey: category.key})), 404, 'FILE_NOT_FOUND')
            })

            it('rejects an oversized object (the declared size was a lie) and deletes it', async () => {
                const target = await cover()
                fakeFileStorage.simulateUpload(target.key, {sizeBytes: 5 * MB + 1, contentType: 'image/png'})

                expectError(await admin.post('/admin/brands', brandBody({imageKey: target.key})), 400, 'FILE_TOO_LARGE')

                expect(exists(target.key)).toBe(false)
            })

            it('rejects a logo bigger than 1 MB and a JPEG logo and deletes them', async () => {
                const [big, jpeg] = [await logo(), await logo()]
                fakeFileStorage.simulateUpload(big.key, {sizeBytes: MB + 1, contentType: 'image/png'})
                fakeFileStorage.simulateUpload(jpeg.key, {sizeBytes: 100, contentType: 'image/jpeg'})

                expectError(await admin.post('/admin/brands', brandBody({logoKey: big.key})), 400, 'FILE_TOO_LARGE')
                expectError(await admin.post('/admin/brands', brandBody({logoKey: jpeg.key})), 400, 'FILE_TYPE_NOT_ALLOWED')

                expect([exists(big.key), exists(jpeg.key)]).toEqual([false, false])
            })

            it('rejects a bad new image on edit and leaves the brand unchanged', async () => {
                const good = await cover()
                const brand = (await admin.post('/admin/brands', brandBody({imageKey: good.key}))).json().data

                expectError(await admin.patch(`/admin/brands/${brand.id}`, {imageKey: 'brands/covers/2030/01/nope.png', name: 'Nope'}), 404, 'FILE_NOT_FOUND')

                expect((await admin.get('/admin/brands')).json().data.find((b: any) => b.id === brand.id)).toMatchObject({
                    imageKey: good.key,
                    name: brand.name,
                })
            })
        })

        it.each([
            ['an empty imageKey', {imageKey: ''}],
            ['an imageKey over 255 chars', {imageKey: 'k'.repeat(256)}],
            ['an empty logoKey', {logoKey: ''}],
        ])('rejects %s', async (_label, overrides) => {
            expectValidationError(await admin.post('/admin/brands', brandBody(overrides)))
        })

        describe('deleting a brand', () => {
            it('removes its cover and logo files', async () => {
                const [coverImage, logoImage] = [await cover(), await logo()]
                const brand = (await admin.post('/admin/brands', brandBody({imageKey: coverImage.key, logoKey: logoImage.key}))).json().data

                expect((await admin.delete(`/admin/brands/${brand.id}`)).statusCode).toBe(200)

                expect([exists(coverImage.key), exists(logoImage.key)]).toEqual([false, false])
            })

            it('works for a brand without images', async () => {
                const brand = await createBrand(admin)

                expect((await admin.delete(`/admin/brands/${brand.id}`)).statusCode).toBe(200)
            })

            it('keeps the files when the brand still has products', async () => {
                const image = await cover()
                const brand = (await admin.post('/admin/brands', brandBody({imageKey: image.key}))).json().data
                await createPublishedProduct(ctx.app, admin, {brandId: brand.id, variants: [{}]})

                expectError(await admin.delete(`/admin/brands/${brand.id}`), 409, 'BRAND_HAS_PRODUCTS')

                expect(exists(image.key)).toBe(true)
            })
        })
    })

    describe('categories: attaching images', () => {
        it('creates a category with an image and exposes key and URL (admin) and URL only (public tree)', async () => {
            const image = await catImage()

            const res = await admin.post('/admin/categories', categoryBody({imageKey: image.key}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({imageKey: image.key, imageUrl: image.publicUrl})
            const node = (await anonymous.get('/categories')).json().data.find((c: any) => c.id === res.json().data.id)
            expect(node).toEqual({id: res.json().data.id, name: res.json().data.name, slug: res.json().data.slug, imageUrl: image.publicUrl, children: []})
        })

        it('has no image by default and shows the image of nested categories', async () => {
            const parent = await createCategory(admin)
            const image = await catImage()
            const child = (await admin.post('/admin/categories', categoryBody({parentId: parent.id, imageKey: image.key}))).json().data

            expect(parent).toMatchObject({imageKey: null, imageUrl: null})
            const tree = (await anonymous.get('/categories')).json().data
            const node = tree.find((c: any) => c.id === parent.id)
            expect(node.imageUrl).toBeNull()
            expect(node.children[0]).toMatchObject({id: child.id, imageUrl: image.publicUrl})
        })

        it('sets, replaces and clears the image on edit', async () => {
            const category = await createCategory(admin)
            const [first, second] = [await catImage(), await catImage()]

            expect((await admin.patch(`/admin/categories/${category.id}`, {imageKey: first.key})).json().data.imageUrl).toBe(first.publicUrl)
            expect((await admin.patch(`/admin/categories/${category.id}`, {imageKey: second.key})).json().data.imageKey).toBe(second.key)
            expect((await admin.patch(`/admin/categories/${category.id}`, {imageKey: null})).json().data).toMatchObject({imageKey: null, imageUrl: null})
        })

        it('does not re-verify an unchanged key', async () => {
            const image = await catImage()
            const category = (await admin.post('/admin/categories', categoryBody({imageKey: image.key}))).json().data
            fakeFileStorage.objects.delete(image.key)

            expect((await admin.patch(`/admin/categories/${category.id}`, {imageKey: image.key, sortOrder: 3})).statusCode).toBe(200)
        })

        it('verifies the object: missing, wrong folder, oversized, wrong type', async () => {
            const [wrongFolder, big, pdf] = [await cover(), await catImage(), await catImage()]
            fakeFileStorage.simulateUpload(big.key, {sizeBytes: 5 * MB + 1, contentType: 'image/png'})
            fakeFileStorage.simulateUpload(pdf.key, {sizeBytes: 100, contentType: 'application/pdf'})

            expectError(await admin.post('/admin/categories', categoryBody({imageKey: 'categories/2030/01/missing.png'})), 404, 'FILE_NOT_FOUND')
            expectError(await admin.post('/admin/categories', categoryBody({imageKey: wrongFolder.key})), 404, 'FILE_NOT_FOUND')
            expectError(await admin.post('/admin/categories', categoryBody({imageKey: big.key})), 400, 'FILE_TOO_LARGE')
            expectError(await admin.post('/admin/categories', categoryBody({imageKey: pdf.key})), 400, 'FILE_TYPE_NOT_ALLOWED')
            expect([exists(big.key), exists(pdf.key), exists(wrongFolder.key)]).toEqual([false, false, true])
        })

        it.each([
            ['an empty imageKey', {imageKey: ''}],
            ['an imageKey over 255 chars', {imageKey: 'k'.repeat(256)}],
        ])('rejects %s', async (_label, overrides) => {
            expectValidationError(await admin.post('/admin/categories', categoryBody(overrides)))
        })

        describe('deleting a category', () => {
            it('removes its image file', async () => {
                const image = await catImage()
                const category = (await admin.post('/admin/categories', categoryBody({imageKey: image.key}))).json().data

                expect((await admin.delete(`/admin/categories/${category.id}`)).statusCode).toBe(200)

                expect(exists(image.key)).toBe(false)
            })

            it('keeps the file when the category has children or products', async () => {
                const [withChild, withProduct] = [await catImage(), await catImage()]
                const parent = (await admin.post('/admin/categories', categoryBody({imageKey: withChild.key}))).json().data
                await createCategory(admin, {parentId: parent.id})
                const used = (await admin.post('/admin/categories', categoryBody({imageKey: withProduct.key}))).json().data
                await createPublishedProduct(ctx.app, admin, {categoryId: used.id, variants: [{}]})

                expectError(await admin.delete(`/admin/categories/${parent.id}`), 409, 'CATEGORY_HAS_CHILDREN')
                expectError(await admin.delete(`/admin/categories/${used.id}`), 409, 'CATEGORY_HAS_PRODUCTS')

                expect([exists(withChild.key), exists(withProduct.key)]).toEqual([true, true])
            })
        })
    })

    describe('access control', () => {
        it('is admin only, and the upload-url endpoints also need the CSRF header', async () => {
            const shopper = (await createUserSession(ctx)).api
            const noCsrf = apiWithoutCsrf(ctx.app, adminSession.session)
            const routes: [string, unknown][] = [
                ['/admin/brands/images/upload-url', {kind: 'cover', contentType: 'image/png', sizeBytes: 10}],
                ['/admin/categories/images/upload-url', {contentType: 'image/png', sizeBytes: 10}],
            ]

            for (const [url, body] of routes) {
                expect([401, 403]).toContain((await anonymous.post(url, body)).statusCode)
                expect((await shopper.post(url, body)).statusCode).toBe(403)
                expect([401, 403]).toContain((await noCsrf.post(url, body)).statusCode)
            }
        })
    })
})