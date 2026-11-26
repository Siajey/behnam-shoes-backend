import {
  IShippingMethodRepository, normalizePlace, ShippingMethodNotFoundError, ShippingQuote,
} from '@api/shipping/domain'

import { IQuoteShipping, QuoteShippingCommand } from '../../interfaces/system'
import { IParcelEstimator } from '../../ports'
import { ShippingQuoter } from '../../services'

export default class QuoteShippingUseCase implements IQuoteShipping {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly estimator: IParcelEstimator,
    private readonly quoter: ShippingQuoter,
  ) {}

  async execute(command: QuoteShippingCommand): Promise<ShippingQuote> {
    const method = await this.methods.findByCode(command.methodCode)
    if (!method || !method.isActive) throw new ShippingMethodNotFoundError({ code: command.methodCode })

    return this.quoter.quote(method, {
      destination: normalizePlace(command.destination),
      parcel: this.estimator.estimate(command.lines),
      subtotalAfterDiscounts: command.subtotalAfterDiscounts,
    })
  }
}
