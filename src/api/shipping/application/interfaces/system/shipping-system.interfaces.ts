import { ParcelLine, ShippingPlace, ShippingQuote } from '@api/shipping/domain'

export interface QuoteShippingCommand {
  methodCode: string
  destination: ShippingPlace
  lines: ParcelLine[]
  subtotalAfterDiscounts: number
}

export interface IQuoteShipping {
  execute(command: QuoteShippingCommand): Promise<ShippingQuote>
}
