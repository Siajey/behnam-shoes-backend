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
} from '../../util/test.util'
import {cdnUrl, fakeFileStorage} from '../../util/fake-file-storage'
import {
    createCategory,
    createProduct,
    getAdminProduct,
    publishProduct,
    seedVariants,
    stubUploaded,
    uploadProductImage,
} from './product-test.util'

const MAX = 5 * 1024 * 1024
const UPLOAD_URL = '/admin/products/images/upload-url'

describe('Admin products: image upload (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    let shopper: Api
    let adminSession: Awaited<ReturnType<typeof createUserSession>>

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        shopper = (await createUserSession(ctx)).api
        anonymous = anonymousApi(ctx.app)
    })

    const requestUpload = (body: Record<string, unknown>, api: Api = admin) => api.post(UPLOAD_URL, body)
    const putGallery = (productId: string, keys: string[]) =>
        admin.put(`/admin/products/${productId}/gallery`, {images: keys.map((fileKey) => ({fileKey}))})
    const keyIn = (folder: string, name = 'x.png') => `${folder}/2030/01/${name}`

    describe('POST /admin/products/images/upload-url', () => {
        it('returns a presigned upload target', async () => {
            const res = await requestUpload({contentType: 'image/png', sizeBytes: 2048})

            expectOk(res, 201, 'PRODUCT_IMAGE_UPLOAD_URL_SUCCESS')
            const data = res.json().data
            expect(data).toEqual({
                key: expect.any(String),
                uploadUrl: expect.stringContaining(data.key),
                method: 'PUT',
                headers: {'Content-Type': 'image/png', 'Cache-Control': expect.any(String)},
                expiresInSeconds: expect.any(Number),
                publicUrl: cdnUrl(data.key),
            })
            expect(data.expiresInSeconds).toBeGreaterThan(0)
        })

        it('generates the key itself: products/<year>/<month>/<uuid>.<ext>', async () => {
            const now = new Date()

            const {key} = (await requestUpload({contentType: 'image/png', sizeBytes: 10})).json().data

            expect(key).toMatch(/^products\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.png$/)
            expect(key.split('/')[1]).toBe(String(now.getUTCFullYear()))
        })

        it.each([
            ['image/jpeg', 'jpg'],
            ['image/png', 'png'],
            ['image/webp', 'webp'],
        ])('accepts %s and uses the .%s extension', async (contentType, extension) => {
            const res = await requestUpload({contentType, sizeBytes: 1000})

            expect(res.statusCode).toBe(201)
            expect(res.json().data.key.endsWith(`.${extension}`)).toBe(true)
            expect(res.json().data.headers['Content-Type']).toBe(contentType)
        })

        it('never lets the client choose the key and never reuses one', async () => {
            const body = {contentType: 'image/png', sizeBytes: 10, key: 'products/evil.png', fileKey: 'products/evil.png'}

            const keys = new Set<string>()
            for (let i = 0; i < 5; i++) keys.add((await requestUpload(body)).json().data.key)

            expect(keys.size).toBe(5)
            keys.forEach((key) => expect(key).not.toContain('evil'))
        })

        it('does not create anything in the bucket (only the browser upload does)', async () => {
            const {key} = (await requestUpload({contentType: 'image/png', sizeBytes: 10})).json().data

            expect(fakeFileStorage.objects.has(key)).toBe(false)
        })

        it.each([
            'image/avif', 'image/gif', 'image/svg+xml', 'application/pdf', 'video/mp4',
            'text/plain', 'IMAGE/PNG', 'image/png; charset=utf-8', '',
        ])('rejects the content type %p', async (contentType) => {
            expectValidationError(await requestUpload({contentType, sizeBytes: 100}))
        })

        it.each([1, 1024, MAX])('accepts a declared size of %d bytes', async (sizeBytes) => {
            expect((await requestUpload({contentType: 'image/webp', sizeBytes})).statusCode).toBe(201)
        })

        it.each([0, -1, MAX + 1, 1.5, '1024', null])('rejects the declared size %p', async (sizeBytes) => {
            expectValidationError(await requestUpload({contentType: 'image/webp', sizeBytes}))
        })

        it.each([
            ['a missing contentType', {sizeBytes: 100}],
            ['a missing sizeBytes', {contentType: 'image/png'}],
            ['an empty body', {}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await requestUpload(body))
        })

        it('is admin only', async () => {
            const body = {contentType: 'image/png', sizeBytes: 10}

            expect([401, 403]).toContain((await requestUpload(body, anonymous)).statusCode)
            expect((await requestUpload(body, shopper)).statusCode).toBe(403)
            expect([401, 403]).toContain((await requestUpload(body, apiWithoutCsrf(ctx.app, adminSession.session))).statusCode)
        })
    })

    describe('attaching uploaded images (PUT /admin/products/:id/gallery)', () => {
        it('accepts keys that were really uploaded and exposes their public URL', async () => {
            const product = await createProduct(admin)
            const [a, b] = [await uploadProductImage(admin), await uploadProductImage(admin, {contentType: 'image/webp'})]

            const res = await putGallery(product.id, [a.key, b.key])

            expect(res.statusCode).toBe(200)
            expect(res.json().data.images).toEqual([
                {id: expect.any(String), fileKey: a.key, url: a.publicUrl, altText: null, position: 0},
                {id: expect.any(String), fileKey: b.key, url: b.publicUrl, altText: null, position: 1},
            ])
        })

        it('turns an uploaded image into the public primary image of a published product', async () => {
            const category = await createCategory(admin)
            const {variants} = await seedVariants(ctx.app, [{}])
            const product = await createProduct(admin, {categoryId: category.id, variantIds: [variants[0].id]})
            const target = await uploadProductImage(admin)
            expect((await putGallery(product.id, [target.key])).statusCode).toBe(200)

            await publishProduct(admin, product.id)

            const detail = (await anonymous.get(`/products/${product.id}`)).json().data
            const image = {fileKey: target.key, url: target.publicUrl, altText: null}
            expect(detail.primaryImage).toEqual(image)
            expect(detail.images).toEqual([image])
        })

        it('rejects a key that was never uploaded and leaves the gallery untouched', async () => {
            const product = await createProduct(admin)
            const kept = await uploadProductImage(admin)
            await putGallery(product.id, [kept.key])

            expectError(await putGallery(product.id, [keyIn('products', 'never-uploaded.png')]), 404, 'FILE_NOT_FOUND')

            expect((await getAdminProduct(admin, product.id)).images.map((i: any) => i.fileKey)).toEqual([kept.key])
        })

        it('is all-or-nothing: one missing key rejects the whole request', async () => {
            const product = await createProduct(admin)
            const good = await uploadProductImage(admin)

            expectError(await putGallery(product.id, [good.key, keyIn('products', 'missing.png')]), 404, 'FILE_NOT_FOUND')

            expect((await getAdminProduct(admin, product.id)).images).toEqual([])
            expect(fakeFileStorage.objects.has(good.key)).toBe(true) // a valid upload is never deleted
        })

        it.each([
            ['an object in another folder', keyIn('brands', 'logo.png')],
            ['a key that only starts like the folder', 'productsX/2030/01/a.png'],
            ['a key with a path traversal', 'products/../secret.png'],
            ['a key without a folder', 'a.png'],
        ])('rejects %s even if the object exists', async (_label, key) => {
            fakeFileStorage.simulateUpload(key, {sizeBytes: 100, contentType: 'image/png'})
            const product = await createProduct(admin)

            expectError(await putGallery(product.id, [key]), 404, 'FILE_NOT_FOUND')

            expect(fakeFileStorage.objects.has(key)).toBe(true) // outside the policy folder: not touched
        })

        it('rejects an object bigger than the limit (the declared size was a lie) and deletes it', async () => {
            const product = await createProduct(admin)
            const target = await uploadProductImage(admin, {sizeBytes: 1000})
            fakeFileStorage.simulateUpload(target.key, {sizeBytes: MAX + 1, contentType: 'image/png'})

            expectError(await putGallery(product.id, [target.key]), 400, 'FILE_TOO_LARGE')

            expect(fakeFileStorage.objects.has(target.key)).toBe(false)
            expect((await getAdminProduct(admin, product.id)).images).toEqual([])
        })

        it.each([
            ['application/pdf', 'application/pdf'],
            ['image/gif', 'image/gif'],
            ['no content type at all', null],
        ])('rejects an object stored as %s and deletes it', async (_label, contentType) => {
            const product = await createProduct(admin)
            const key = keyIn('products', `bad-${Math.random().toString(36).slice(2)}.png`)
            fakeFileStorage.simulateUpload(key, {sizeBytes: 100, contentType})

            expectError(await putGallery(product.id, [key]), 400, 'FILE_TYPE_NOT_ALLOWED')

            expect(fakeFileStorage.objects.has(key)).toBe(false)
        })

        it('accepts an object whose stored content type has a different case or parameters', async () => {
            const product = await createProduct(admin)
            const key = keyIn('products', `case-${Math.random().toString(36).slice(2)}.png`)
            fakeFileStorage.simulateUpload(key, {sizeBytes: 100, contentType: 'IMAGE/PNG; foo=bar'})

            expect((await putGallery(product.id, [key])).statusCode).toBe(200)
        })

        it('accepts an object of exactly the maximum size', async () => {
            const product = await createProduct(admin)
            const target = await uploadProductImage(admin, {sizeBytes: MAX})

            expect((await putGallery(product.id, [target.key])).statusCode).toBe(200)
        })

        it('only verifies new keys: reordering existing images does not need the files', async () => {
            const product = await createProduct(admin)
            const [a, b] = [await uploadProductImage(admin), await uploadProductImage(admin)]
            await putGallery(product.id, [a.key, b.key])
            fakeFileStorage.objects.delete(a.key) // e.g. removed from the bucket by a cleanup job

            const res = await putGallery(product.id, [b.key, a.key])

            expect(res.statusCode).toBe(200)
            expect(res.json().data.images.map((i: any) => i.fileKey)).toEqual([b.key, a.key])
        })

        it('does not delete the file when an image is removed from the gallery', async () => {
            const product = await createProduct(admin)
            const [a, b] = [await uploadProductImage(admin), await uploadProductImage(admin)]
            await putGallery(product.id, [a.key, b.key])

            await putGallery(product.id, [b.key])

            expect(fakeFileStorage.objects.has(a.key)).toBe(true)
        })

        it('can attach the same uploaded file to several products', async () => {
            const [one, two] = [await createProduct(admin), await createProduct(admin)]
            const target = await uploadProductImage(admin)

            expect((await putGallery(one.id, [target.key])).statusCode).toBe(200)
            expect((await putGallery(two.id, [target.key])).statusCode).toBe(200)
        })

        it('clears a gallery without touching the storage', async () => {
            const product = await createProduct(admin)
            const target = await uploadProductImage(admin)
            await putGallery(product.id, [target.key])

            const res = await putGallery(product.id, [])

            expect(res.json().data.images).toEqual([])
            expect(fakeFileStorage.objects.has(target.key)).toBe(true)
        })

        it('still accepts stubbed keys from the shared test helpers', async () => {
            const product = await createProduct(admin)
            const key = `products/${product.id}/img-0.webp`
            stubUploaded(key)

            expect((await putGallery(product.id, [key])).statusCode).toBe(200)
        })
    })
})