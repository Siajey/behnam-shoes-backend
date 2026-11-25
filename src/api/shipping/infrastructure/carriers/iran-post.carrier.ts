import { Injectable } from '@nestjs/common'
import { toLatinDigits } from '@common/util'

import { IShippingCarrier } from '@api/shipping/application'

@Injectable()
export class IranPostCarrier implements IShippingCarrier {
  readonly name = 'iran_post'

  isValidTrackingCode(code: string): boolean {
    return /^\d{24}$/.test(toLatinDigits(code.trim()))
  }

  trackingUrl(): string {
    return 'https://tracking.post.ir/'
  }
}
