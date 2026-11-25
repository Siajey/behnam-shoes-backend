import { Inject, Injectable } from '@nestjs/common'

import { IQuoteShipping } from '@api/shipping/application'
import { QUOTE_SHIPPING } from '@common/di'
import {
  IOrderShippingQuotes, ShippingQuoteRequest, ShippingQuoteResult,
} from '@api/order/application'

@Injectable()
export class ShippingModuleQuotes implements IOrderShippingQuotes {
  constructor(@Inject(QUOTE_SHIPPING) private readonly quoteShipping: IQuoteShipping) {}

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuoteResult> {
    const quote = await this.quoteShipping.execute({
      methodCode: request.methodCode,
      destination: request.destination,
      lines: request.lines,
      subtotalAfterDiscounts: request.subtotalAfterDiscounts,
    })
    return { methodCode: quote.methodCode, methodName: quote.name, fee: quote.fee }
  }
}
