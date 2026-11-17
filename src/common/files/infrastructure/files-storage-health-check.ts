import {Inject, Injectable, OnModuleInit} from "@nestjs/common";

import {APP_LOGGER_SERVICE, FILE_STORAGE} from "@common/di";
import {S3FileStorage} from "@common/files";
import {ILogger} from "@common/logger";

@Injectable()
export default class FilesStorageHealthCheck implements OnModuleInit {

    constructor(
        @Inject(FILE_STORAGE)
        private readonly storage: S3FileStorage,
        @Inject(APP_LOGGER_SERVICE)
        private readonly logger: ILogger
    ) {
    }

    async onModuleInit(): Promise<void> {
        try {
            const now = Date.now()
            await this.storage.ping()
            this.logger.info('S3 storage connection established successfully.', {
                module: 'Files',
                operation: 'ready',
                event: 'ping',
                durationMs: Date.now() - now,
            })
        } catch (error) {
            this.logger.error(
                'Failed to connect to S3 storage.',
                {
                    module: 'Files',
                    operation: 'error',
                    event: 'ping',
                    err: error instanceof Error ? error.stack : String(error),
                }
            )
            throw error
        }
    }
}