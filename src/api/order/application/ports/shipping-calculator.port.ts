export interface ShippingQuote {
  subtotalAfterDiscounts: number
  province: string
}

export interface IShippingCalculator {
  calculate(quote: ShippingQuote): Promise<number>
}
