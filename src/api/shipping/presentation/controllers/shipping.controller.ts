import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { IListShippingOptions } from '@api/shipping/application'
import { JwtSessionGuard } from '@api/session/presentation'
import { User } from '@api/users/domain'
import { SuccessResponse } from '@common/api'
import { ReqUser } from '@common/decorator'
import { LIST_SHIPPING_OPTIONS } from '@common/di'
import { ZodValidationPipe } from '@common/validations'

import { ShippingOptionsQuery, ShippingOptionsQuerySchema } from '../dto'
import { ShippingPresenter } from '../presenters'

@Controller('shipping')
@Throttle({ default: { ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 60 : 10_000 } })
export default class ShippingController {
  constructor(
    @Inject(LIST_SHIPPING_OPTIONS) private readonly listOptions: IListShippingOptions,
  ) {}

  @Get('options')
  @UseGuards(JwtSessionGuard)
  async optionsController(
    @Query(new ZodValidationPipe(ShippingOptionsQuerySchema)) query: ShippingOptionsQuery,
    @ReqUser() user: User,
  ) {
    const options = await this.listOptions.execute(query, user.id)
    return new SuccessResponse({
      messageObj: { message: 'common.shipping.optionsSuccess' },
      code: 'SHIPPING_OPTIONS_SUCCESS',
      path: '/shipping/options',
      data: { options: options.map(ShippingPresenter.option) },
    })
  }
}
