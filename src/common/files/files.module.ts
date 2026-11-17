import {S3Client} from '@aws-sdk/client-s3'
import {Module} from '@nestjs/common'

import {ConfigProvider} from '@common/configuration'
import {
    CONFIG_PROVIDER,
    FILE_STORAGE,
    S3_CLIENT,
} from '@common/di'

import {createFileStorage, FilesStorageHealthCheck} from './infrastructure'

@Module({
    providers: [
        {
            provide: S3_CLIENT,
            inject: [CONFIG_PROVIDER],
            useFactory: (config: ConfigProvider) =>
                new S3Client({
                    region: 'default',
                    endpoint: config.get('S3_ENDPOINT'),
                    forcePathStyle:
                        (config.getOptional('S3_FORCE_PATH_STYLE') ?? 'true') === 'true',
                    credentials: {
                        accessKeyId: config.get('S3_ACCESS_KEY_ID'),
                        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
                    },
                    requestChecksumCalculation: 'WHEN_REQUIRED',
                    responseChecksumValidation: 'WHEN_REQUIRED',
                }),
        },
        {
            provide: FILE_STORAGE,
            inject: [CONFIG_PROVIDER, S3_CLIENT],
            useFactory: createFileStorage,
        },
        FilesStorageHealthCheck,
    ],
    exports: [FILE_STORAGE],
})
export class FilesModule {}