import { Inject, Injectable } from '@nestjs/common'

import { IGetShippingInfo } from '@api/users/application'
import { ShippingPlace } from '@api/shipping/domain'
import { GET_SHIPPING_INFO } from '@common/di'
import { IShippingDestinations } from '@api/shipping/application'

@Injectable()
export class ProfileShippingDestinations implements IShippingDestinations {
  constructor(@Inject(GET_SHIPPING_INFO) private readonly shippingInfo: IGetShippingInfo) {}

  async get(userId: string, addressId: string): Promise<ShippingPlace> {
    const { address } = await this.shippingInfo.execute(userId, addressId)
    return { postalCode: address.postalCode, province: address.province, city: address.city }
  }
}
