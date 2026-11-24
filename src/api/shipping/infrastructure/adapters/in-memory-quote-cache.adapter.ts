import { Inject, Injectable } from '@nestjs/common'

import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'
import { CarrierQuote, IQuoteCache } from '@api/shipping/application'

const MAX_ENTRIES = 1000

@Injectable()
export class InMemoryQuoteCache implements IQuoteCache {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<CarrierQuote> }>()
  private readonly ttlMs: number

  constructor(@Inject(CONFIG_PROVIDER) config: ConfigProvider) {
    const seconds = Number(config.getOptional('SHIPPING_QUOTE_CACHE_SECONDS') ?? 600)
    this.ttlMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
  }

  getOrLoad(key: string, loader: () => Promise<CarrierQuote>): Promise<CarrierQuote> {
    const now = Date.now()
    const hit = this.entries.get(key)
    if (hit && hit.expiresAt > now) return hit.value

    const value = loader()
    if (this.ttlMs === 0) return value

    this.prune(now)
    this.entries.set(key, { expiresAt: now + this.ttlMs, value })
    value.catch(() => this.entries.delete(key))
    return value
  }

  private prune(now: number): void {
    if (this.entries.size < MAX_ENTRIES) return
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key)
    for (const key of this.entries.keys()) {
      if (this.entries.size < MAX_ENTRIES) break
      this.entries.delete(key)
    }
  }
}
