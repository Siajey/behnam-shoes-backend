import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post} from '@nestjs/common'

import {
    ICreateShippingMethod,
    IDeleteShippingMethod,
    IEditShippingMethod,
    IGetShippingMethod,
    IListShippingMethods,
} from '@api/shipping/application'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {AdminOnly, AdminWriteOnly, ReqUser} from '@common/decorator'
import {
    CREATE_SHIPPING_METHOD,
    DELETE_SHIPPING_METHOD,
    EDIT_SHIPPING_METHOD,
    GET_SHIPPING_METHOD,
    LIST_SHIPPING_METHODS,
} from '@common/di'
import {ZodValidationPipe,uuidSchema} from '@common/validations'

import {
    CreateShippingMethodBody,
    CreateShippingMethodSchema,
    EditShippingMethodBody,
    EditShippingMethodSchema,
} from '../dto'
import {ShippingPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/shipping-methods')
export default class AdminShippingMethodController {
    constructor(
        @Inject(LIST_SHIPPING_METHODS) private readonly listMethods: IListShippingMethods,
        @Inject(GET_SHIPPING_METHOD) private readonly getMethod: IGetShippingMethod,
        @Inject(CREATE_SHIPPING_METHOD) private readonly createMethod: ICreateShippingMethod,
        @Inject(EDIT_SHIPPING_METHOD) private readonly editMethod: IEditShippingMethod,
        @Inject(DELETE_SHIPPING_METHOD) private readonly deleteMethod: IDeleteShippingMethod,
    ) {
    }

    @Get()
    @AdminOnly()
    async listController() {
        const methods = await this.listMethods.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.shipping.methodListSuccess'},
            code: 'SHIPPING_METHOD_LIST_SUCCESS',
            path: '/admin/shipping-methods',
            data: methods.map(ShippingPresenter.method),
        })
    }

    @Get(':id')
    @AdminOnly()
    async getController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj: {message: 'common.shipping.methodGetSuccess'},
            code: 'SHIPPING_METHOD_GET_SUCCESS',
            path: `/admin/shipping-methods/${id}`,
            data: ShippingPresenter.method(await this.getMethod.execute(id)),
        })
    }

    @Post()
    @AdminWriteOnly()
    async createController(
        @Body(new ZodValidationPipe(CreateShippingMethodSchema)) body: CreateShippingMethodBody,
        @ReqUser() user: User,
    ) {
        const method = await this.createMethod.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.shipping.methodCreateSuccess'},
            code: 'SHIPPING_METHOD_CREATE_SUCCESS',
            path: '/admin/shipping-methods',
            status: HttpStatus.CREATED,
            data: ShippingPresenter.method(method),
        })
    }

    @Patch(':id')
    @AdminWriteOnly()
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditShippingMethodSchema)) body: EditShippingMethodBody,
        @ReqUser() user: User,
    ) {
        const method = await this.editMethod.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.shipping.methodUpdateSuccess'},
            code: 'SHIPPING_METHOD_UPDATE_SUCCESS',
            path: `/admin/shipping-methods/${id}`,
            data: ShippingPresenter.method(method),
        })
    }

    @Delete(':id')
    @AdminWriteOnly()
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteMethod.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.shipping.methodDeleteSuccess'},
            code: 'SHIPPING_METHOD_DELETE_SUCCESS',
            path: `/admin/shipping-methods/${id}`,
            data: null,
        })
    }
}
