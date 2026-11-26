import {
  IShippingMethodRepository, normalizePlace, ShippingOption, ShippingQuoteUnavailableError,
} from '@api/shipping/domain'

import { IListShippingOptions, ListShippingOptionsCommand } from '../../interfaces/public'
import {
  ICheckoutParcels, IParcelEstimator, IShippingDestinations,
} from '../../ports'
import { ShippingQuoter } from '../../services'

export default class ListShippingOptionsUseCase implements IListShippingOptions {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly destinations: IShippingDestinations,
    private readonly checkout: ICheckoutParcels,
    private readonly estimator: IParcelEstimator,
    private readonly quoter: ShippingQuoter,
  ) {}

  async execute(command: ListShippingOptionsCommand, userId: string): Promise<ShippingOption[]> {
    const destination = normalizePlace(await this.destinations.get(userId, command.addressId))
    const cart = await this.checkout.get(userId)
    const parcel = this.estimator.estimate(cart.lines)
    const methods = await this.methods.findActive()

    return Promise.all(
      methods.map(async (method): Promise<ShippingOption> => {
        try {
          const quote = await this.quoter.quote(method, {
            destination,
            parcel,
            subtotalAfterDiscounts: cart.subtotalAfterDiscounts,
          })
          return { ...quote, available: true }
        } catch (error) {
          if (error instanceof ShippingQuoteUnavailableError) {
            return {
              methodCode: method.code,
              name: method.name,
              description: method.description,
              available: false,
            }
          }
          throw error
        }
      }),
    )
  }
}
