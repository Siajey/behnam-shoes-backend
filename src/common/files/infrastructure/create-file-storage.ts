import {S3Client} from '@aws-sdk/client-s3'

import {ConfigProvider} from '@common/configuration'
import {IFileStorage} from '@common/storage'
import {ILogger} from "@common/logger";

import {S3FileStorage} from './s3-file-storage'

export function createFileStorage(config: ConfigProvider, s3Client: S3Client, logger: ILogger): IFileStorage {
    const driver = config.getOptional('STORAGE_DRIVER') ?? 's3'

    switch (driver) {
        case 's3':
            return new S3FileStorage(s3Client, {
                    bucket: config.get('S3_BUCKET'),
                    publicBaseUrl: config.get('STORAGE_PUBLIC_BASE_URL').replace(/\/+$/, ''),
                    uploadUrlTtlSeconds: Number(
                        config.getOptional('STORAGE_UPLOAD_URL_TTL_SECONDS') ?? 300,
                    ),
                },
                logger)
        default:
            throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`)
    }
}
