import { Inject, Injectable } from '@nestjs/common'

import { normalizePlace, ShippingPlace } from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'
import { IShippingOrigin } from '@api/shipping/application'

@Injectable()
export class ConfigShippingOrigin implements IShippingOrigin {
  private place: ShippingPlace | null = null

  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}

  get(): ShippingPlace {
    this.place ??= normalizePlace({
      postalCode: this.config.get('SHIPPING_ORIGIN_POSTAL_CODE'),
      province: this.config.get('SHIPPING_ORIGIN_PROVINCE'),
      city: this.config.get('SHIPPING_ORIGIN_CITY'),
    })
    return this.place
  }
}
