import {
    DeleteObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'

import {
    FileStorage,
    StoredObjectInfo,
    UploadRequest,
    UploadTarget,
} from '@common/storage'

export interface S3StorageSettings {
    bucket: string
    publicBaseUrl: string
    uploadUrlTtlSeconds: number
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

export class S3FileStorage extends FileStorage {
    constructor(
        private readonly client: S3Client,
        private readonly settings: S3StorageSettings,
    ) {
        super()
    }

    protected async presignUpload(
        key: string,
        request: UploadRequest,
    ): Promise<Omit<UploadTarget, 'key' | 'publicUrl'>> {
        const url = await getSignedUrl(
            this.client,
            new PutObjectCommand({
                Bucket: this.settings.bucket,
                Key: key,
                ContentType: request.contentType,
                CacheControl: CACHE_CONTROL,
            }),
            {expiresIn: this.settings.uploadUrlTtlSeconds},
        )

        return {
            method: 'PUT',
            url,
            headers: {
                'Content-Type': request.contentType,
                'Cache-Control': CACHE_CONTROL,
            },
            expiresInSeconds: this.settings.uploadUrlTtlSeconds,
        }
    }

    async ping(): Promise<void> {
        await this.client.send(
            new HeadBucketCommand({
                Bucket: this.settings.bucket,
            }),
        )
    }

    async head(key: string): Promise<StoredObjectInfo | null> {
        try {
            const result = await this.client.send(
                new HeadObjectCommand({Bucket: this.settings.bucket, Key: key}),
            )

            return {
                key,
                sizeBytes: result.ContentLength ?? 0,
                contentType: result.ContentType ?? null,
            }
        } catch (error) {
            const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
            if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null
            throw error
        }
    }

    async delete(key: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({Bucket: this.settings.bucket, Key: key}),
        )
    }

    publicUrl(key: string): string {
        return `${this.settings.publicBaseUrl}/${key}`
    }
}
