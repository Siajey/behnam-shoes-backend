import { Inject, Injectable } from '@nestjs/common'

import { Parcel, ParcelLine } from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'
import { IParcelEstimator } from '@api/shipping/application'

@Injectable()
export class ConfigParcelEstimator implements IParcelEstimator {
  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}

  estimate(lines: readonly ParcelLine[]): Parcel {
    const itemGrams = this.number('SHIPPING_DEFAULT_ITEM_WEIGHT_GRAMS', 1200)
    const packagingGrams = this.number('SHIPPING_PACKAGING_WEIGHT_GRAMS', 300)
    const units = lines.reduce((sum, l) => sum + l.quantity, 0)

    return {
      weightGrams: units * itemGrams + (units > 0 ? packagingGrams : 0),
      declaredValue: lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    }
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.config.getOptional(key) ?? fallback)
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }
}
