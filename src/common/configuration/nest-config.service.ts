import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ConfigProvider } from '@common/configuration'
import { readSecret, Secrets } from '@common/security'

@Injectable()
export class NestConfigProvider implements ConfigProvider {
  private readonly cache = new Map<string, string>()

  private readonly isProduction =
    this.configService.get('NODE_ENV') === 'production'

  constructor(private readonly configService: ConfigService) {}

  get(key: string): string {
    if (!this.isProduction || !Secrets.has(key)) {
      return this.configService.getOrThrow<string>(key)
    }

    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const value = readSecret(key) ?? this.configService.getOrThrow<string>(key)

    this.cache.set(key, value)

    return value
  }

  getOptional(key: string): string | undefined {
    if (!this.isProduction || !Secrets.has(key)) {
      return this.configService.get<string>(key)
    }

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const value = readSecret(key) ?? this.configService.get<string>(key)

    if (value !== undefined) {
      this.cache.set(key, value)
    }

    return value
  }
}
