import { ShippingOption } from '@api/shipping/domain'

export interface ListShippingOptionsCommand {
  addressId: string
}

export interface IListShippingOptions {
  execute(command: ListShippingOptionsCommand, userId: string): Promise<ShippingOption[]>
}
