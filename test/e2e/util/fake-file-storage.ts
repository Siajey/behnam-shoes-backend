import {FileStorage, StoredObjectInfo, UploadRequest, UploadTarget} from '@common/storage'

export const FAKE_CDN = 'https://cdn.test'
export const cdnUrl = (key: string) => `${FAKE_CDN}/${key}`

export class FakeFileStorage extends FileStorage {
    readonly objects = new Map<string, StoredObjectInfo>()

    protected async presignUpload(
        key: string,
        request: UploadRequest,
    ): Promise<Omit<UploadTarget, 'key' | 'publicUrl'>> {
        return {
            method: 'POST',
            fields: {},
            url: `https://upload.test/${key}?signature=fake`,
            headers: {'Content-Type': request.contentType, 'Cache-Control': 'public, max-age=31536000, immutable'},
            expiresInSeconds: 300,
        }
    }

    async head(key: string) {
        return this.objects.get(key) ?? null
    }

    async delete(keys: string | string[]) {
        for (const key of ([] as string[]).concat(keys)) this.objects.delete(key)
    }

    publicUrl(key: string) {
        return cdnUrl(key)
    }

    /** What the browser's PUT to the presigned URL does to the bucket. */
    simulateUpload(key: string, info: {sizeBytes: number; contentType: string | null}) {
        this.objects.set(key, {key, ...info})
    }

    ping() {
        return true
    }
}

/** One instance per spec file: test-context injects it, specs "upload" into it. */
export const fakeFileStorage = new FakeFileStorage()