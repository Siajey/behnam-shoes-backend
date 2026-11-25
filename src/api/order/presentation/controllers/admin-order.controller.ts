import {Body, Controller, Get, Inject, Param, Post, Query} from '@nestjs/common'

import {IAdminGetOrder, IAdminListOrders, IUpdateOrderStatus} from '@api/order/application'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {AdminOnly, AdminWriteOnly, ReqUser} from '@common/decorator'
import {ADMIN_GET_ORDER, ADMIN_LIST_ORDERS, FILE_STORAGE, UPDATE_ORDER_STATUS} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {AdminListOrdersQuery, AdminListOrdersQuerySchema, UpdateOrderStatusBody, UpdateOrderStatusSchema,} from '../dto'
import {toAdminOrderListCriteria} from '../mappers'
import {OrderPresenter} from '../presenters'
import {IFileStorage} from "@common/storage";

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/orders')
export default class AdminOrderController {
    constructor(
        @Inject(ADMIN_LIST_ORDERS) private readonly listOrders: IAdminListOrders,
        @Inject(ADMIN_GET_ORDER) private readonly getOrder: IAdminGetOrder,
        @Inject(UPDATE_ORDER_STATUS) private readonly updateStatus: IUpdateOrderStatus,
        @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    ) {
    }

    private readonly urlOf = (key: string): string => this.storage.publicUrl(key)

    @Get()
    @AdminOnly()
    async listController(
        @Query(new ZodValidationPipe(AdminListOrdersQuerySchema)) query: AdminListOrdersQuery,
    ) {
        const page = await this.listOrders.execute(toAdminOrderListCriteria(query))
        return new SuccessResponse({
            messageObj: {message: 'common.order.listSuccess'},
            code: 'ORDER_LIST_SUCCESS',
            path: '/admin/orders',
            data: {
                items: page.orders.map((o) => OrderPresenter.adminSummary(o, this.urlOf)),
                nextCursor: page.nextCursor
            },
        })
    }

    @Get(':id')
    @AdminOnly()
    async getController(@Param('id', idPipe) id: string) {
        const { order, shipment } = await this.getOrder.execute(id)

        return new SuccessResponse({
            messageObj: {message: 'common.order.getSuccess'},
            code: 'ORDER_GET_SUCCESS',
            path: `/admin/orders/${id}`,
            data: OrderPresenter.adminDetail(order,this.urlOf, {shipment}),
        })
    }

    @Post(':id/status')
    @AdminWriteOnly()
    async statusController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) body: UpdateOrderStatusBody,
        @ReqUser() user: User,
    ) {
        const order = await this.updateStatus.execute({orderId: id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.order.statusUpdateSuccess'},
            code: 'ORDER_STATUS_UPDATE_SUCCESS',
            path: `/admin/orders/${id}/status`,
            data: OrderPresenter.adminDetail(order,this.urlOf),
        })
    }
}
