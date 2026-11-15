import { Inject, Injectable } from '@nestjs/common'
import { IGetShippingInfo } from '@api/users/application'
import { GET_SHIPPING_INFO } from '@common/di'

import { IShippingDetailsProvider, ShippingDetails } from '@api/order/application'

@Injectable()
export class ProfileShippingDetails implements IShippingDetailsProvider {
  constructor(
    @Inject(GET_SHIPPING_INFO) private readonly shippingInfo: IGetShippingInfo,
  ) {}

  async get(userId: string, addressId: string): Promise<ShippingDetails> {
    const info = await       this.shippingInfo.execute(userId, addressId)

    return {
      address: info.address,
      recipient: {
        firstName: info.recipient.firstName,
        lastName: info.recipient.lastName,
        phoneNumber: info.recipient.phoneNumber,
      },
    }
  }
}
