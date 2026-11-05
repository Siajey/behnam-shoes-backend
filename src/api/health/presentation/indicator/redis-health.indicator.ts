import {Inject, Injectable} from '@nestjs/common'
import {HealthIndicatorResult, HealthIndicatorService} from '@nestjs/terminus'
import KeyvRedis from '@keyv/redis'

import {ConfigProvider} from '@common/configuration'
import {CONFIG_PROVIDER} from '@common/di'

@Injectable()
export default class RedisHealthIndicator {
    constructor(
        private readonly healthIndicatorService: HealthIndicatorService,
        @Inject(CONFIG_PROVIDER)
        private readonly configService: ConfigProvider,
    ) {
    }

    async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
        try {
            const indicator = this.healthIndicatorService.check(key)
            const redisService = new KeyvRedis(
                this.configService.get('REDIS_URL') || '',
            )
            await redisService.client.connect()
            return indicator.up()
        } catch (err) {
            if (typeof err === 'object')
                if ('code' in err && err.code && err.code === 'ECONNREFUSED') {
                    return this.healthIndicatorService
                        .check(key)
                        .down('Redis connection refused')
                } else if ('message' in err && err.message) {
                    if (err.message === 'Invalid URL') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('Invalid Redis URL')
                    }
                    if (err.message === 'Protocol not supported') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('Unsupported Redis protocol')
                    }
                    if (err.message === 'No valid host specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis host specified')
                    }
                    if (err.message === 'No valid port specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis port specified')
                    }
                    if (err.message === 'No valid database specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis database specified')
                    }
                    if (err.message === 'No valid password specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis password specified')
                    }
                    if (err.message === 'No valid username specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis username specified')
                    }
                    if (err.message === 'No valid timeout specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis timeout specified')
                    }
                    if (err.message === 'No valid retry infrastructure specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis retry infrastructure specified')
                    }
                    if (err.message === 'No valid family specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis family specified')
                    }
                    if (err.message === 'No valid path specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis path specified')
                    }
                    if (err.message === 'No valid tls specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis tls specified')
                    }
                    if (err.message === 'No valid url specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis url specified')
                    }
                    if (err.message === 'No valid client specified') {
                        return this.healthIndicatorService
                            .check(key)
                            .down('No valid Redis client specified')
                    }
                }
        }
    }
}
