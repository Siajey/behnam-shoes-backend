import { Inject, Injectable } from '@nestjs/common'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'

import { IShippingCalculator, ShippingQuote } from '../../application/ports'

@Injectable()
export class ConfigShippingCalculator implements IShippingCalculator {
  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}

  async calculate(quote: ShippingQuote): Promise<number> {
    const fee = Number(this.config.getOptional('SHIPPING_FLAT_FEE') ?? 0)
    const freeFrom = Number(this.config.getOptional('SHIPPING_FREE_THRESHOLD') ?? 0)

    if (freeFrom > 0 && quote.subtotalAfterDiscounts >= freeFrom) return 0
    return Number.isFinite(fee) && fee > 0 ? Math.floor(fee) : 0
  }
}
