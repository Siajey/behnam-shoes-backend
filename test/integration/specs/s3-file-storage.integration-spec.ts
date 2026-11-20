import {afterAll, beforeAll, describe, expect, it, jest} from '@jest/globals'
import {randomUUID} from 'node:crypto'

jest.mock('@nestjs/common', () => ({
    Catch: () => () => undefined,
    Injectable: () => () => undefined,
    Optional: () => () => undefined,
    Inject: () => () => undefined,
    Logger: class Logger {
        log() {
        }

        error() {
        }

        warn() {
        }

        debug() {
        }

        verbose() {
        }
    },
    HttpException: class HttpException extends Error {
        constructor(
            private readonly response: unknown,
            private readonly status: number,
        ) {
            super(typeof response === 'string' ? response : JSON.stringify(response))
        }

        getStatus() {
            return this.status
        }

        getResponse() {
            return this.response
        }
    },
    HttpStatus: {
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        PAYLOAD_TOO_LARGE: 413,
        UNSUPPORTED_MEDIA_TYPE: 415,
        INTERNAL_SERVER_ERROR: 500,
    },
}))

import {S3FileStorage} from '@common/files/infrastructure/s3-file-storage'
import {FileNotFoundError, FileTooLargeError, FileTypeNotAllowedError, UploadPolicy} from '@common/storage'
import {ILogger, LogMeta} from '@common/logger'
import {DeleteObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

jest.setTimeout(30_000)

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
)

const env = (key: string) => {
    const value = process.env[key]
    if (!value) throw new Error(`${key} is required when S3_INTEGRATION=1`)
    return value
}

describe('S3FileStorage against a real bucket', () => {
    const runId = randomUUID().slice(0, 8)
    const policy: UploadPolicy = {
        folder: `integration-tests/${runId}`,
        allowedContentTypes: ['image/png', 'image/jpeg'],
        maxSizeBytes: 1024 * 1024,
    }
    const created = new Set<string>()
    let client: S3Client
    let storage: S3FileStorage
    let logger: ILogger
    let bucket: string
    let publicBaseUrl: string

    const clientConfig = () => ({
        region: process.env.S3_REGION ?? 'us-east-1',
        endpoint: env('S3_ENDPOINT'),
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
        credentials: {accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY')},
        requestChecksumCalculation: 'WHEN_REQUIRED' as const,
        responseChecksumValidation: 'WHEN_REQUIRED' as const,
    })

    const upload = async (
        target: {
            url: string;
            fields: Record<string, string>;
            headers: Record<string, string>;
        },
        body: Buffer = PNG,
    ): Promise<Response> => {
        const formData = new FormData();

        for (const [key, value] of Object.entries(target.fields)) {
            formData.append(key, value);
        }

        formData.append(
            'file',
            new Blob([new Uint8Array(body)], {type: 'image/png'}),
            'test.png',
        );

        return fetch(target.url, {
            method: 'POST',
            body: formData,
        });
    }

    const newTarget = async (sizeBytes = PNG.length, contentType = 'image/png') => {
        const target = await storage.createUploadTarget(policy, {contentType, sizeBytes})
        created.add(target.key)
        return target
    }

    beforeAll(() => {
        bucket = env('S3_BUCKET')
        publicBaseUrl = env('STORAGE_PUBLIC_BASE_URL').replace(/\/+$/, '')
        client = new S3Client(clientConfig())
        logger = {
            async info(message: string, meta?: LogMeta): Promise<void> {
            },
            async warn(message: string, meta?: LogMeta): Promise<void> {
            },
            async error(message: string, meta?: LogMeta): Promise<void> {
            },
            async debug(message: string, meta?: LogMeta): Promise<void> {
            }

        }
        storage = new S3FileStorage(client, {bucket, publicBaseUrl, uploadUrlTtlSeconds: 300}, logger)
    })

    afterAll(async () => {
        for (const key of created) {
            await client.send(new DeleteObjectCommand({Bucket: bucket, Key: key})).catch(() => undefined)
        }
        client?.destroy()
    })

    describe('presigned upload', () => {
        it('creates a signed URL for the configured endpoint, valid for the configured time', async () => {
            const target = await newTarget()
            const url = new URL(target.url)
            const fields = target.fields
            expect(url.origin).toBe(new URL(env('S3_ENDPOINT')).origin)
            expect(fields.key).toBe(target.key)
            expect(fields['X-Amz-Signature']).toBeTruthy()
            expect(fields['X-Amz-Algorithm']).toBeTruthy()
            expect(fields['X-Amz-Date']).toBeTruthy()
        })

        it('accepts an upload made exactly like the browser does it (also proves the checksum options work)', async () => {
            const target = await newTarget()

            const res = await upload(target)
            expect([200,204]).toContain(res.status)
            expect(await storage.head(target.key)).toEqual({
                key: target.key,
                sizeBytes: PNG.length,
                contentType: 'image/png'
            })
        })

        it('stores the signed Cache-Control and Content-Type', async () => {
            const target = await newTarget()
            await upload(target)

            const head = await client.send(
                new (await import('@aws-sdk/client-s3')).HeadObjectCommand({Bucket: bucket, Key: target.key}),
            )

            expect(head.CacheControl).toBe('public, max-age=31536000, immutable')
            expect(head.ContentType).toBe('image/png')
        })

        it('verifyUploaded accepts a valid upload and keeps the object', async () => {
            const target = await newTarget()
            await upload(target)

            await expect(storage.verifyUploaded(policy, target.key)).resolves.toMatchObject({sizeBytes: PNG.length})

            expect(await storage.head(target.key)).not.toBeNull()
        })

        it('rejects an upload with a different Content-Type than the one that was signed', async () => {
            const target = await newTarget()

            const res = await upload({
                url: target.url,
                fields: target.fields,
                headers: {...target.headers, 'Content-Type': 'application/pdf'}
            })

            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(await storage.head(target.key)).toBeNull()
        })

        it('rejects an upload without the signed Cache-Control header', async () => {
            const target = await newTarget()

            const res = await upload({url: target.url, fields: target.fields, headers: {'Content-Type': 'image/png'}})

            if (res.status < 400) {
                const head = await client.send(new (await import('@aws-sdk/client-s3')).HeadObjectCommand({
                    Bucket: bucket,
                    Key: target.key
                }))
                expect(head.CacheControl).not.toBe('public, max-age=31536000, immutable')
            }
        })

        it('does not let a URL signed for one key upload to another', async () => {
            const target = await newTarget()
            const other = target.key.replace(/[^/]+$/, `${randomUUID()}.png`)
            created.add(other)

            const res = await upload({
                url: target.url.replace(target.key, other),
                fields: target.fields,
                headers: target.headers
            })

            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(await storage.head(other)).toBeNull()
        })

        it('stops working after the URL expired', async () => {
            const shortLived = new S3FileStorage(client, {bucket, publicBaseUrl, uploadUrlTtlSeconds: 1}, logger)
            const target = await shortLived.createUploadTarget(policy, {
                contentType: 'image/png',
                sizeBytes: PNG.length
            })
            created.add(target.key)
            expect(target.expiresInSeconds).toBe(1)

            await new Promise((resolve) => setTimeout(resolve, 3000))
            const res = await upload(target)

            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(await storage.head(target.key)).toBeNull()
        })
    })

    describe('verification of what was really uploaded', () => {
        it('reports a key that was never uploaded as missing', async () => {
            const key = `${policy.folder}/2030/01/${randomUUID()}.png`

            expect(await storage.head(key)).toBeNull()
            await expect(storage.verifyUploaded(policy, key)).rejects.toBeInstanceOf(FileNotFoundError)
        })

        it('deletes an object that is bigger than the declared size allowed (declared 50 bytes, real 2 MB)', async () => {
            const target = await newTarget(50)
            const big = Buffer.alloc(2 * 1024 * 1024, 1)
            expect((await upload(target, big)).status).toBe(200)

            await expect(storage.verifyUploaded(policy, target.key)).rejects.toBeInstanceOf(FileTooLargeError)

            expect(await storage.head(target.key)).toBeNull()
        })

        it('deletes an object stored with a forbidden type (e.g. through a leaked credential)', async () => {
            const key = `${policy.folder}/2030/01/${randomUUID()}.pdf`
            created.add(key)
            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: Buffer.from('%PDF-1.4'),
                ContentType: 'application/pdf'
            }))

            await expect(storage.verifyUploaded(policy, key)).rejects.toBeInstanceOf(FileTypeNotAllowedError)

            expect(await storage.head(key)).toBeNull()
        })

        it('does not look outside the policy folder', async () => {
            const outside = `integration-tests/other-${runId}/a.png`
            created.add(outside)
            await client.send(new PutObjectCommand({Bucket: bucket, Key: outside, Body: PNG, ContentType: 'image/png'}))

            await expect(storage.verifyUploaded(policy, outside)).rejects.toBeInstanceOf(FileNotFoundError)

            expect(await storage.head(outside)).not.toBeNull() // untouched
        })
    })

    describe('delete', () => {
        it('removes an object, and deleting a missing one does not fail', async () => {
            const target = await newTarget()
            await upload(target)

            await storage.delete([target.key])
            await expect(storage.delete([target.key])).resolves.toBeUndefined()

            expect(await storage.head(target.key)).toBeNull()
        })
    })

    describe('public URL (opt-in: S3_CHECK_PUBLIC_URL=1)', () => {
        it('serves the uploaded object through the CDN with the immutable cache header', async () => {
            const target = await newTarget()
            await upload(target)

            const res = await fetch(target.publicUrl)
            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toBe('image/png')
            expect(res.headers.get('cache-control')).toContain('immutable')
            expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true)
        })
    })

    describe.skip('bucket CORS (opt-in: S3_TEST_ORIGIN)', () => {

        it('allows a browser PUT with Content-Type and Cache-Control from the admin origin', async () => {
            const target = await newTarget()

            const res = await fetch(target.url, {
                method: 'OPTIONS',
                headers: {
                    Origin: env('S3_TEST_ORIGIN'),
                    'Access-Control-Request-Method': 'PUT',
                    'Access-Control-Request-Headers': 'content-type,cache-control',
                },
            })

            expect(res.status).toBeLessThan(300)
            expect(res.headers.get('access-control-allow-origin')).toMatch(new RegExp(`^(\\*|${env('S3_TEST_ORIGIN')})$`))
            expect((res.headers.get('access-control-allow-methods') ?? '').toUpperCase()).toContain('PUT')
            const allowed = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase()
            expect(allowed === '*' || (allowed.includes('content-type') && allowed.includes('cache-control'))).toBe(true)
        })

        it('does not allow an unrelated origin', async () => {
            const target = await newTarget()

            const res = await fetch(target.url, {
                method: 'OPTIONS',
                headers: {Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT'},
            })

            const allow = res.headers.get('access-control-allow-origin')
            expect(res.status >= 400 || allow === null || (allow !== '*' && allow !== 'https://evil.example')).toBe(true)
        })
    })
})