import { Inject, Injectable } from '@nestjs/common'
import { ShippingCarrierError } from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'

import { CarrierQuote, CarrierQuoteRequest, IShippingCarrier } from '@api/shipping/application/ports'

interface RateEntry {
  baseFee: number
  perKgFee: number
  sameProvinceBaseFee?: number
  minDays?: number
  maxDays?: number
}

@Injectable()
export class RateTableCarrier implements IShippingCarrier {
  readonly name = 'rate_table'
  private table: Record<string, RateEntry> | null = null

  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}

  async quote(request: CarrierQuoteRequest): Promise<CarrierQuote> {
    const entry = this.load()[request.service]
    if (!entry) throw this.fail('unknown_service')

    const kilograms = Math.max(1, Math.ceil(request.parcel.weightGrams / 1000))
    const sameProvince =
      request.origin.province === request.destination.province && entry.sameProvinceBaseFee !== undefined
    const base = sameProvince ? (entry.sameProvinceBaseFee as number) : entry.baseFee

    return {
      fee: base + (kilograms - 1) * entry.perKgFee,
      estimatedDays:
        entry.minDays !== undefined && entry.maxDays !== undefined
          ? { min: entry.minDays, max: entry.maxDays }
          : null,
    }
  }

  private load(): Record<string, RateEntry> {
    if (this.table) return this.table
    try {
      this.table = JSON.parse(this.config.getOptional('SHIPPING_RATE_TABLE') ?? '{}')
      return this.table as Record<string, RateEntry>
    } catch {
      throw this.fail('invalid_rate_table')
    }
  }

  private fail(code: string): ShippingCarrierError {
    return new ShippingCarrierError({ carrier: this.name, stage: 'quote', code, retryable: false })
  }
}
