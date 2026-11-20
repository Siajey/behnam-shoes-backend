import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common'

import { IGetProductAttributes, ISetProductAttributes } from '@api/product/application'
import { User } from '@api/users/domain'
import { SuccessResponse } from '@common/api'
import { AdminOnly, AdminWriteOnly, ReqUser } from '@common/decorator'
import { GET_PRODUCT_ATTRIBUTES, SET_PRODUCT_ATTRIBUTES } from '@common/di'
import { uuidSchema,ZodValidationPipe } from '@common/validations'

import { SetProductAttributesBody, SetProductAttributesSchema } from '../../dtos'
import { AttributePresenter } from '../../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/products')
export default class AdminProductAttributeController {
  constructor(
    @Inject(GET_PRODUCT_ATTRIBUTES) private readonly getAttributes: IGetProductAttributes,
    @Inject(SET_PRODUCT_ATTRIBUTES) private readonly setAttributes: ISetProductAttributes,
  ) {}

  @Get(':id/attributes')
  @AdminOnly()
  async getController(@Param('id', idPipe) id: string) {
    const attributes = await this.getAttributes.execute(id)
    return new SuccessResponse({
      messageObj: { message: 'common.product.attributesGetSuccess' },
      code: 'PRODUCT_ATTRIBUTES_GET_SUCCESS',
      path: `/admin/products/${id}/attributes`,
      data: { attributes: attributes.map(AttributePresenter.resolved) },
    })
  }

  @Put(':id/attributes')
  @AdminWriteOnly()
  async setController(
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(SetProductAttributesSchema)) body: SetProductAttributesBody,
    @ReqUser() user: User,
  ) {
    const attributes = await this.setAttributes.execute({ productId: id, values: body.values }, user.id)
    return new SuccessResponse({
      messageObj: { message: 'common.product.attributesUpdateSuccess' },
      code: 'PRODUCT_ATTRIBUTES_UPDATE_SUCCESS',
      path: `/admin/products/${id}/attributes`,
      data: { attributes: attributes.map(AttributePresenter.resolved) },
    })
  }
}
