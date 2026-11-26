import { Parcel, ParcelLine, ShippingPlace } from '@api/shipping/domain'

import { CarrierQuote } from './shipping-carrier.port'

export interface IQuoteCache {
  getOrLoad(key: string, loader: () => Promise<CarrierQuote>): Promise<CarrierQuote>
}

export interface IShippingOrigin {
  get(): ShippingPlace
}

export interface IParcelEstimator {
  estimate(lines: readonly ParcelLine[]): Parcel
}

export interface CheckoutParcels {
  lines: ParcelLine[]
  subtotalAfterDiscounts: number
}

export interface ICheckoutParcels {
  get(userId: string): Promise<CheckoutParcels>
}

export interface IShippingDestinations {
  get(userId: string, addressId: string): Promise<ShippingPlace>
}
