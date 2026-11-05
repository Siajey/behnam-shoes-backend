import {
    applyDecorators,
    Controller,
    Get,
    Inject,
    Logger,
    ServiceUnavailableException,
    UseGuards,
} from '@nestjs/common'
import {
    DiskHealthIndicator,
    HealthCheck,
    HealthCheckService,
    HealthIndicatorFunction,
    HttpHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus'

import { JwtSessionGuard, RolesGuard } from '@api/session/presentation'
import { Roles } from '@common/decorator'
import { UserRole } from '@api/users/domain'
import {
    DatabaseHealthIndicator,
    RedisHealthIndicator,
} from '@api/health/presentation'
import { CONFIG_PROVIDER } from '@common/di'
import { ConfigProvider } from '@common/configuration'

const MB = 1024 * 1024
const HEAP_LIMIT_BYTES = 500 * MB
const HEAP_LIMIT_BYTES_TEST = 2048 * MB
const DISK_THRESHOLD = 0.9
const DISK_PATH = '/'

const PUBLIC_CACHE_MS = 3_000
const PUBLIC_TIMEOUT_MS = 2_000

const AdminOnly = () =>
    applyDecorators(UseGuards(JwtSessionGuard, RolesGuard), Roles(UserRole.ADMIN))

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`health check timed out after ${ms}ms`)),
                ms,
            ).unref(),
        ),
    ])

@Controller('health')
export default class HealthController {
    private readonly logger = new Logger(HealthController.name)
    private publicCache?: { at: number; ok: boolean }
    private publicInflight?: Promise<boolean>

    constructor(
        @Inject(CONFIG_PROVIDER)
        private readonly configProvider: ConfigProvider,
        private readonly health: HealthCheckService,
        private readonly databaseHealth: DatabaseHealthIndicator,
        private readonly disk: DiskHealthIndicator,
        private readonly memory: MemoryHealthIndicator,
        private readonly http: HttpHealthIndicator,
        private readonly redis: RedisHealthIndicator,
    ) {}

    @Get('live')
    liveness() {
        return { status: 'ok' }
    }

    @Get('public')
    async publicCheck() {
        if (!(await this.isPublicHealthy())) {
            throw new ServiceUnavailableException({ status: 'error' })
        }
        return { status: 'ok' }
    }

    @Get('ready')
    @AdminOnly()
    @HealthCheck()
    checkReadiness() {
        const checks: HealthIndicatorFunction[] = [
            this.databaseCheck(),
            this.diskCheck(),
            this.memoryCheck(),
            this.redisCheck(),
        ]

        const frontendUrl = this.configProvider.get('FRONTEND_URL')
        if (this.isProduction && frontendUrl) {
            checks.push(() => this.http.pingCheck('frontend', frontendUrl))
        }

        return this.health.check(checks)
    }

    @Get('database')
    @AdminOnly()
    @HealthCheck()
    checkDb() {
        return this.health.check([this.databaseCheck()])
    }

    @Get('disk')
    @AdminOnly()
    @HealthCheck()
    checkDisk() {
        return this.health.check([this.diskCheck()])
    }

    @Get('memory')
    @AdminOnly()
    @HealthCheck()
    checkMemory() {
        return this.health.check([this.memoryCheck()])
    }

    @Get('redis')
    @AdminOnly()
    @HealthCheck()
    checkRedis() {
        return this.health.check([this.redisCheck()])
    }


    private get isTest(): boolean {
        return this.configProvider.get('NODE_ENV') === 'test'
    }

    private get isProduction(): boolean {
        return this.configProvider.get('NODE_ENV') === 'production'
    }

    private databaseCheck(): HealthIndicatorFunction {
        return () => this.databaseHealth.isHealthy('database')
    }

    private redisCheck(): HealthIndicatorFunction {
        return () => this.redis.isHealthy()
    }

    private diskCheck(): HealthIndicatorFunction {
        return () =>
            this.isTest
                ? { storage: { status: 'up' } }
                : this.disk.checkStorage('storage', {
                    threshold: DISK_THRESHOLD,
                    path: DISK_PATH,
                })
    }

    private memoryCheck(): HealthIndicatorFunction {
        const limit = this.isTest ? HEAP_LIMIT_BYTES_TEST : HEAP_LIMIT_BYTES
        return () => this.memory.checkHeap('memory_heap', limit)
    }


    private isPublicHealthy(): Promise<boolean> {
        const cached = this.publicCache
        if (cached && Date.now() - cached.at < PUBLIC_CACHE_MS) {
            return Promise.resolve(cached.ok)
        }

        this.publicInflight ??= this.runPublicCheck().finally(() => {
            this.publicInflight = undefined
        })
        return this.publicInflight
    }

    private async runPublicCheck(): Promise<boolean> {
        let ok = true
        try {
            await withTimeout(
                this.health.check([this.databaseCheck()]),
                PUBLIC_TIMEOUT_MS,
            )
        } catch (error: any) {
            ok = false
            this.logger.warn(
                { failure: error?.response ?? error?.message },
                'public health check failed',
            )
        }
        this.publicCache = { at: Date.now(), ok }
        return ok
    }
}