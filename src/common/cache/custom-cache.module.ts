import { Inject, Module, OnModuleInit } from '@nestjs/common'
import KeyvRedis from '@keyv/redis'
import Keyv from 'keyv'
import { readFileSync } from 'fs'
import { Cache } from 'cache-manager'

import { APP_LOGGER_SERVICE, CACHE_MANAGER, CONFIG_PROVIDER } from '@common/di'
import { ConfigProvider, CustomConfigModule } from '@common/configuration'
import { ILogger } from '@common/logger'

@Module({
  imports: [CustomConfigModule],
  providers: [
    {
      provide: CACHE_MANAGER,
      inject: [CONFIG_PROVIDER, APP_LOGGER_SERVICE],
      useFactory: (configService: ConfigProvider, logger: ILogger) => {
        const redisUrl = configService.get('REDIS_URL')
        const isProd = configService.get('NODE_ENV') === 'production'

        const redisOptions: any = { url: redisUrl }

        if (isProd) {
          const caPath = configService.get('REDIS_CA_PATH')
          const certPath = configService.get('REDIS_APP_CERT_PATH')
          const keyPath = configService.get('REDIS_APP_KEY_PATH')

          redisOptions.socket = {
            tls: true,
            ca: caPath ? [readFileSync(caPath)] : undefined,
            cert: certPath ? readFileSync(certPath) : undefined,
            key: keyPath ? readFileSync(keyPath) : undefined,
            rejectUnauthorized: true,
          }
        }

        const store = new KeyvRedis(redisOptions)

        store.on('connect', () => {
          logger.info('Redis connected successfully', {
            module: 'CustomCacheModule',
            event: 'cache.connect',
            operation: 'connect',
          })
        })

        store.on('error', (error: unknown) => {
          logger.error('Redis connection failed', {
            module: 'CustomCacheModule',
            event: 'cache.connect',
            operation: 'connect',
            err: error,
          })
        })

        store.on('reconnecting', () => {
          logger.warn('Redis reconnecting...', {
            module: 'CustomCacheModule',
            event: 'cache.reconnect',
            operation: 'connect',
          })
        })

        return new Keyv({
          store,
          namespace: configService.get('NODE_ENV'),
        })
      },
    },
  ],
  exports: [CACHE_MANAGER],
})
export default class CustomCacheModule implements OnModuleInit {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    @Inject(APP_LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async onModuleInit() {
    try {
      await this.cache.set('__health_check__', 'ok', 1000)
      await this.cache.get('__health_check__')
    } catch (error) {
      this.logger.error('Redis connection failed', {
        module: 'Cache',
        event: 'cache.connect',
        err: error,
      })
    }
  }
}
