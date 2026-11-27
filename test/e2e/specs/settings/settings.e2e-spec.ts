import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
    UserSession,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
} from '../../util/test.util'
import {cdnUrl, fakeFileStorage} from '../../util/fake-file-storage'
import {MB, UPLOAD_URL, adminSettings, publicSettings, putHero, resetHero, uploadSettingsImage} from './settings-test.util'

describe('Settings: hero image (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let anonymous: Api
    const exists = (key: string) => fakeFileStorage.objects.has(key)

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        anonymous = anonymousApi(ctx.app)
    })

    afterEach(async () => {
        fakeFileStorage.failDeletes = null
        await resetHero(admin)
    })

    describe('defaults', () => {
        it('has no hero image or alt text when nothing was ever set (public and admin)', async () => {
            expect(await publicSettings(anonymous)).toEqual({hero: {imageUrl: null, altText: null}})
            expect(await adminSettings(admin)).toEqual({hero: {imageKey: null, imageUrl: null, altText: null}})
        })
    })

    describe('GET /settings (public)', () => {
        it('needs no session and answers with the public response code', async () => {
            const res = await anonymous.get('/settings')

            expectOk(res, 200, 'SETTINGS_GET_SUCCESS')
        })

        it('is cacheable for one minute', async () => {
            const res = await anonymous.get('/settings')

            expect(res.headers['cache-control']).toBe('public, max-age=60')
        })

        it('shows only URLs (no storage keys, no admin fields)', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key, altText: 'Summer sale'})

            const data = await publicSettings(anonymous)

            expect(data).toEqual({hero: {imageUrl: cdnUrl(image.key), altText: 'Summer sale'}})
            expect(data.hero).not.toHaveProperty('imageKey')
        })

        it('is the same for a signed-in shopper', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key})
            const shopper = (await createUserSession(ctx)).api

            expect(await publicSettings(shopper)).toEqual(await publicSettings(anonymous))
        })
    })

    describe('POST /admin/settings/images/upload-url', () => {
        it('returns a presigned target in the settings folder', async () => {
            const res = await admin.post(UPLOAD_URL, {contentType: 'image/png', sizeBytes: 5000})

            expectOk(res, 200, 'SETTINGS_UPLOAD_URL_SUCCESS')
            const data = res.json().data
            expect(data).toEqual({
                key: expect.stringMatching(/^settings\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/),
                method: 'POST',
                url: expect.stringContaining(data.key),
                headers: {'Content-Type': 'image/png', 'Cache-Control': expect.any(String)},
                expiresInSeconds: expect.any(Number),
                publicUrl: cdnUrl(data.key),
            })
            expect(data.expiresInSeconds).toBeGreaterThan(0)
        })

        it.each([
            ['image/jpeg', 'jpg'],
            ['image/png', 'png'],
            ['image/webp', 'webp'],
        ])('accepts %s and uses the .%s extension', async (contentType, extension) => {
            const res = await admin.post(UPLOAD_URL, {contentType, sizeBytes: 1000})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.key.endsWith(`.${extension}`)).toBe(true)
        })

        it.each([1, 1024, 5 * MB])('accepts a declared size of %d bytes', async (sizeBytes) => {
            expect((await admin.post(UPLOAD_URL, {contentType: 'image/webp', sizeBytes})).statusCode).toBe(200)
        })

        it('generates the key itself, never reuses one and does not create the object', async () => {
            const keys = new Set<string>()
            for (let i = 0; i < 5; i++) {
                const res = await admin.post(UPLOAD_URL, {contentType: 'image/png', sizeBytes: 10, key: 'settings/evil.png'})
                keys.add(res.json().data.key)
            }

            expect(keys.size).toBe(5)
            keys.forEach((key) => {
                expect(key).not.toContain('evil')
                expect(exists(key)).toBe(false)
            })
        })

        it.each([
            ['an unsupported content type', {contentType: 'image/gif', sizeBytes: 10}],
            ['a document type', {contentType: 'application/pdf', sizeBytes: 10}],
            ['an upper-case content type', {contentType: 'IMAGE/PNG', sizeBytes: 10}],
            ['a missing content type', {sizeBytes: 10}],
            ['a missing size', {contentType: 'image/png'}],
            ['a zero size', {contentType: 'image/png', sizeBytes: 0}],
            ['a negative size', {contentType: 'image/png', sizeBytes: -1}],
            ['a size over 5 MB', {contentType: 'image/png', sizeBytes: 5 * MB + 1}],
            ['a fractional size', {contentType: 'image/png', sizeBytes: 1.5}],
            ['a string size', {contentType: 'image/png', sizeBytes: '10'}],
            ['an empty body', {}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await admin.post(UPLOAD_URL, body))
        })
    })

    describe('PUT /admin/settings/hero', () => {
        it('sets the image and the alt text', async () => {
            const image = await uploadSettingsImage(admin)

            const res = await putHero(admin, {imageKey: image.key, altText: 'Summer sale'})

            expectOk(res, 200, 'SETTINGS_HERO_UPDATE_SUCCESS')
            expect(res.json().data).toEqual({hero: {imageKey: image.key, imageUrl: image.publicUrl, altText: 'Summer sale'}})
            expect(await adminSettings(admin)).toEqual(res.json().data)
            expect(await publicSettings(anonymous)).toEqual({hero: {imageUrl: image.publicUrl, altText: 'Summer sale'}})
        })

        it('sets only the image, or only the alt text, keeping the other', async () => {
            const image = await uploadSettingsImage(admin)

            await putHero(admin, {imageKey: image.key})
            expect(await adminSettings(admin)).toMatchObject({hero: {imageKey: image.key, altText: null}})

            await putHero(admin, {altText: 'Now with text'})
            expect(await adminSettings(admin)).toMatchObject({hero: {imageKey: image.key, altText: 'Now with text'}})
        })

        it('clears the alt text with null and treats a blank one as none', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key, altText: 'Text'})

            expect((await putHero(admin, {altText: null})).json().data.hero.altText).toBeNull()

            await putHero(admin, {altText: 'Again'})
            expectValidationError(await putHero(admin, {altText: '   '}))
            expect((await adminSettings(admin)).hero.altText).toBe('Again')
        })

        it('trims the alt text, accepts 200 characters and normalises Arabic letters to Persian', async () => {
            const long = await putHero(admin, {altText: `  ${'a'.repeat(200)}  `})
            expect(long.json().data.hero.altText).toHaveLength(200)

            const persian = await putHero(admin, {altText: AR_NAME})
            expect(persian.json().data.hero.altText).toBe(FA_NAME)
        })

        it('is idempotent: sending the same image again changes nothing and does not touch the file', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key})
            fakeFileStorage.objects.delete(image.key) // the same key is not verified again

            const res = await putHero(admin, {imageKey: image.key, altText: 'Same image, new text'})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.hero).toMatchObject({imageKey: image.key, altText: 'Same image, new text'})
        })

        describe('replacing the image', () => {
            it('saves the new image and deletes the old file from storage', async () => {
                const [first, second] = [await uploadSettingsImage(admin), await uploadSettingsImage(admin)]
                await putHero(admin, {imageKey: first.key})

                await putHero(admin, {imageKey: second.key})

                expect((await adminSettings(admin)).hero.imageKey).toBe(second.key)
                expect(exists(first.key)).toBe(false)
                expect(exists(second.key)).toBe(true)
            })

            it('keeps the change even when the old file cannot be deleted', async () => {
                const [first, second] = [await uploadSettingsImage(admin), await uploadSettingsImage(admin)]
                await putHero(admin, {imageKey: first.key})
                fakeFileStorage.failDeletes = new Error('storage down')

                const res = await putHero(admin, {imageKey: second.key})

                expect(res.statusCode).toBe(200)
                expect((await adminSettings(admin)).hero.imageKey).toBe(second.key)
                expect(exists(first.key)).toBe(true) // stays behind, only logged
            })

            it('does not delete anything when only the alt text changes', async () => {
                const image = await uploadSettingsImage(admin)
                await putHero(admin, {imageKey: image.key})

                await putHero(admin, {altText: 'Only text'})

                expect(exists(image.key)).toBe(true)
            })

            it('does not delete the current file when the new image is rejected', async () => {
                const image = await uploadSettingsImage(admin)
                await putHero(admin, {imageKey: image.key})

                expectError(await putHero(admin, {imageKey: 'settings/2030/01/never-uploaded.png'}), 404, 'FILE_NOT_FOUND')

                expect(exists(image.key)).toBe(true)
                expect((await adminSettings(admin)).hero.imageKey).toBe(image.key)
            })
        })

        describe('verification of what was really uploaded', () => {
            it('rejects a key that was never uploaded and changes nothing', async () => {
                const image = await uploadSettingsImage(admin)
                await putHero(admin, {imageKey: image.key, altText: 'Keep'})

                expectError(await putHero(admin, {imageKey: 'settings/2030/01/missing.png', altText: 'Lost'}), 404, 'FILE_NOT_FOUND')

                expect((await adminSettings(admin)).hero).toMatchObject({imageKey: image.key, altText: 'Keep'})
            })

            it.each([
                ['another folder', 'products/2030/01/a.png'],
                ['a folder that only starts like the settings folder', 'settingsX/2030/01/a.png'],
                ['a path traversal', 'settings/../secret.png'],
                ['a key without a folder', 'a.png'],
            ])('rejects %s even if the object exists and leaves it alone', async (_label, key) => {
                fakeFileStorage.simulateUpload(key, {sizeBytes: 100, contentType: 'image/png'})

                expectError(await putHero(admin, {imageKey: key}), 404, 'FILE_NOT_FOUND')

                expect(exists(key)).toBe(true)
                expect((await adminSettings(admin)).hero.imageKey).toBeNull()
            })

            it('rejects an object bigger than 5 MB (the declared size was a lie) and deletes it', async () => {
                const image = await uploadSettingsImage(admin, {sizeBytes: 1000})
                fakeFileStorage.simulateUpload(image.key, {sizeBytes: 5 * MB + 1, contentType: 'image/webp'})

                expectError(await putHero(admin, {imageKey: image.key}), 400, 'FILE_TOO_LARGE')

                expect(exists(image.key)).toBe(false)
                expect((await adminSettings(admin)).hero.imageKey).toBeNull()
            })

            it.each([
                ['application/pdf', 'application/pdf'],
                ['image/gif', 'image/gif'],
                ['no content type', null],
            ])('rejects an object stored as %s and deletes it', async (_label, contentType) => {
                const image = await uploadSettingsImage(admin)
                fakeFileStorage.simulateUpload(image.key, {sizeBytes: 100, contentType})

                expectError(await putHero(admin, {imageKey: image.key}), 400, 'FILE_TYPE_NOT_ALLOWED')

                expect(exists(image.key)).toBe(false)
            })

            it('accepts an object of exactly 5 MB and a content type with another case', async () => {
                const exact = await uploadSettingsImage(admin, {sizeBytes: 5 * MB})
                expect((await putHero(admin, {imageKey: exact.key})).statusCode).toBe(200)

                const cased = await uploadSettingsImage(admin)
                fakeFileStorage.simulateUpload(cased.key, {sizeBytes: 100, contentType: 'IMAGE/PNG; foo=bar'})
                expect((await putHero(admin, {imageKey: cased.key})).statusCode).toBe(200)
            })

            it('does not change the alt text when the image is rejected', async () => {
                await putHero(admin, {altText: 'Before'})

                expectError(await putHero(admin, {imageKey: 'settings/2030/01/missing.png', altText: 'After'}), 404, 'FILE_NOT_FOUND')

                expect((await adminSettings(admin)).hero.altText).toBe('Before')
            })
        })

        it.each([
            ['an empty body', {}],
            ['an empty imageKey', {imageKey: ''}],
            ['a blank imageKey', {imageKey: '   '}],
            ['an imageKey over 255 characters', {imageKey: `settings/${'k'.repeat(250)}`}],
            ['a numeric imageKey', {imageKey: 12}],
            ['a null imageKey (use DELETE /hero/image)', {imageKey: null}],
            ['an alt text over 200 characters', {altText: 'a'.repeat(201)}],
            ['an empty alt text', {altText: ''}],
            ['a numeric alt text', {altText: 5}],
            ['only unknown fields', {mobileImage: 'x'}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await putHero(admin, body))
        })
    })

    describe('DELETE /admin/settings/hero/image', () => {
        it('removes the image and the alt text, and deletes the file', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key, altText: 'Text'})

            const res = await admin.delete('/admin/settings/hero/image')

            expectOk(res, 200, 'SETTINGS_HERO_IMAGE_REMOVE_SUCCESS')
            expect(res.json().data).toEqual({hero: {imageKey: null, imageUrl: null, altText: null}})
            expect(await publicSettings(anonymous)).toEqual({hero: {imageUrl: null, altText: null}})
            expect(exists(image.key)).toBe(false)
        })

        it('succeeds when there is no image (also when repeated)', async () => {
            for (let i = 0; i < 2; i++) {
                const res = await admin.delete('/admin/settings/hero/image')

                expect(res.statusCode).toBe(200)
                expect(res.json().data.hero).toEqual({imageKey: null, imageUrl: null, altText: null})
            }
        })

        it('removes the alt text even when there was only text', async () => {
            await putHero(admin, {altText: 'Only text'})

            await admin.delete('/admin/settings/hero/image')

            expect((await adminSettings(admin)).hero.altText).toBeNull()
        })

        it('keeps the change even when the file cannot be deleted', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key})
            fakeFileStorage.failDeletes = new Error('storage down')

            const res = await admin.delete('/admin/settings/hero/image')

            expect(res.statusCode).toBe(200)
            expect((await adminSettings(admin)).hero.imageKey).toBeNull()
            expect(exists(image.key)).toBe(true)
        })

        it('allows setting a new image afterwards', async () => {
            const [first, second] = [await uploadSettingsImage(admin), await uploadSettingsImage(admin)]
            await putHero(admin, {imageKey: first.key})
            await admin.delete('/admin/settings/hero/image')

            expect((await putHero(admin, {imageKey: second.key})).statusCode).toBe(200)
            expect((await adminSettings(admin)).hero.imageKey).toBe(second.key)
        })
    })

    describe('GET /admin/settings', () => {
        it('returns the keys and URLs of the hero', async () => {
            const image = await uploadSettingsImage(admin)
            await putHero(admin, {imageKey: image.key, altText: 'Text'})

            const res = await admin.get('/admin/settings')

            expectOk(res, 200, 'SETTINGS_ADMIN_GET_SUCCESS')
            expect(res.json().data).toEqual({hero: {imageKey: image.key, imageUrl: image.publicUrl, altText: 'Text'}})
        })
    })

    describe('persistence and isolation', () => {
        it('keeps the setting across requests and sessions, and reflects every change immediately', async () => {
            const [first, second] = [await uploadSettingsImage(admin), await uploadSettingsImage(admin)]

            await putHero(admin, {imageKey: first.key, altText: 'One'})
            const otherAdmin = (await createUserSession(ctx, UserRole.ADMIN)).api
            expect((await adminSettings(otherAdmin)).hero).toMatchObject({imageKey: first.key, altText: 'One'})

            await putHero(otherAdmin, {imageKey: second.key, altText: 'Two'})
            expect(await publicSettings(anonymous)).toEqual({hero: {imageUrl: cdnUrl(second.key), altText: 'Two'}})
        })

        it('does not delete files of other settings or of products when the hero changes', async () => {
            const hero = await uploadSettingsImage(admin)
            const other = await uploadSettingsImage(admin) // uploaded but not used by the hero
            await putHero(admin, {imageKey: hero.key})

            await admin.delete('/admin/settings/hero/image')

            expect(exists(hero.key)).toBe(false)
            expect(exists(other.key)).toBe(true)
        })
    })

    describe('access control', () => {
        it('needs an admin for every admin route, and the CSRF header for writes', async () => {
            const shopper = (await createUserSession(ctx)).api
            const noCsrf = apiWithoutCsrf(ctx.app, adminSession.session)
            const image = await uploadSettingsImage(admin)
            const calls: ['GET' | 'POST' | 'PUT' | 'DELETE', string, unknown?][] = [
                ['GET', '/admin/settings'],
                ['POST', UPLOAD_URL, {contentType: 'image/png', sizeBytes: 10}],
                ['PUT', '/admin/settings/hero', {imageKey: image.key, altText: 'Hacked'}],
                ['DELETE', '/admin/settings/hero/image'],
            ]

            for (const [method, url, body] of calls) {
                expect([401, 403]).toContain((await anonymous.request(method, url, body)).statusCode)
                expect((await shopper.request(method, url, body)).statusCode).toBe(403)
                if (method !== 'GET') expect([401, 403]).toContain((await noCsrf.request(method, url, body)).statusCode)
            }

            // none of the rejected calls changed anything
            expect(await adminSettings(admin)).toEqual({hero: {imageKey: null, imageUrl: null, altText: null}})
            expect(exists(image.key)).toBe(true)
        })

        it('authorises before validating input', async () => {
            expect([401, 403]).toContain((await anonymous.put('/admin/settings/hero', {altText: 'x'.repeat(500)})).statusCode)
            expect((await (await createUserSession(ctx)).api.put('/admin/settings/hero', {altText: 'x'.repeat(500)})).statusCode).toBe(403)
            expectValidationError(await putHero(admin, {altText: 'x'.repeat(500)}))
        })

        it('rejects the old admin session after logout', async () => {
            const session = await createUserSession(ctx, UserRole.ADMIN)
            expect((await session.api.post('/auth/logout')).statusCode).toBe(200)

            expect([401, 403]).toContain((await session.api.get('/admin/settings')).statusCode)
            expect([401, 403]).toContain((await session.api.put('/admin/settings/hero', {altText: 'x'})).statusCode)
            expect(await publicSettings(anonymous)).toEqual({hero: {imageUrl: null, altText: null}})
        })
    })
})
