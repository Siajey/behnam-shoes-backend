import { Controller, Inject, Param, Post } from '@nestjs/common'

import { IRefreshShipment } from '@api/shipping/application'
import { SuccessResponse } from '@common/api'
import { AdminWriteOnly } from '@common/decorator'
import { REFRESH_SHIPMENT } from '@common/di'
import { ZodValidationPipe,uuidSchema } from '@common/validations'

import { ShipmentPresenter } from '../presenters'

@Controller('admin/shipments')
export default class AdminShipmentController {
  constructor(@Inject(REFRESH_SHIPMENT) private readonly refreshShipment: IRefreshShipment) {}

  @Post(':orderId/refresh')
  @AdminWriteOnly()
  async refreshController(@Param('orderId', new ZodValidationPipe(uuidSchema)) orderId: string) {
    const { summary, outcome } = await this.refreshShipment.execute(orderId)
    return new SuccessResponse({
      messageObj: { message: 'common.shipping.shipmentRefreshSuccess' },
      code: 'SHIPMENT_REFRESH_SUCCESS',
      path: `/admin/shipments/${orderId}/refresh`,
      data: { outcome, shipment: ShipmentPresenter.summary(summary) },
    })
  }
}
