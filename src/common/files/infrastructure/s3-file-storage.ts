import {
    DeleteObjectsCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'

import {
    FileStorage,
    StoredObjectInfo,
    UploadRequest,
    UploadTarget,
} from '@common/storage'
import {ILogger} from "@common/logger";

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
        private readonly logger: ILogger,
    ) {
        super()
    }

    protected async presignUpload(
        key: string,
        request: UploadRequest,
    ): Promise<Omit<UploadTarget, 'key' | 'publicUrl'>> {
        const url = await createPresignedPost(this.client, {
            Bucket: this.settings.bucket,
            Key: key,
            Expires: this.settings.uploadUrlTtlSeconds,
            Fields: {
                "Content-Type": request.contentType,
                "acl": "public-read",
                'Cache-Control': CACHE_CONTROL,
            },
            Conditions: [
                ['starts-with', '$key', key.split('/')[0]],
                {acl: 'public-read'},
                {"Content-Type": request.contentType},
                {'Cache-Control': CACHE_CONTROL},
                ['content-length-range', 1, request.sizeBytes],
            ],
        })

        return {
            method: 'POST',
            url: url.url,
            fields: url.fields,
            headers: {
                'Content-Type': request.contentType,
                'Cache-Control': CACHE_CONTROL,
                'content-length-range': 'request.sizeBytes'
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

    async delete(keys: string[]) {
        try {
            await this.client.send(
                new DeleteObjectsCommand({
                    Bucket: this.settings.bucket,
                    Delete: {Objects: keys.map((key) => ({Key: key}))},
                }),
            )
        } catch (err) {
            this.logger.error('Failed to delete files from R2', {
                module: 's3FileStorage',
                event: 'file.delete',
                operation: 'deleteFiles',
                data: {keys},
                err,
            })
            throw err
        }
    }

    publicUrl(key: string): string {
        return `${this.settings.publicBaseUrl}/${key}`
    }
}
