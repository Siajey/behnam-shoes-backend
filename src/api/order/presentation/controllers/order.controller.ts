import {
    Body, Controller, Get, Headers, HttpStatus, Inject, Param, Post, Query, UseGuards,
} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {
    ICancelMyOrder, IGetMyOrder, IListMyOrders, IPlaceOrder,
} from '@api/order/application'
import {CSRFGuard, JwtSessionGuard} from '@api/session/presentation'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {ReqUser} from '@common/decorator'
import {CANCEL_MY_ORDER, GET_MY_ORDER, LIST_MY_ORDERS, PLACE_ORDER} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {ValidationError} from "@common/errors";

import {
    IdempotencyKeySchema, ListMyOrdersQuery, ListMyOrdersQuerySchema, PlaceOrderBody, PlaceOrderSchema,
} from '../dto'
import {OrderPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('orders')
@Throttle({default: {ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 60 : 10_000}})
export default class OrderController {
    constructor(
        @Inject(PLACE_ORDER) private readonly placeOrder: IPlaceOrder,
        @Inject(LIST_MY_ORDERS) private readonly listMyOrders: IListMyOrders,
        @Inject(GET_MY_ORDER) private readonly getMyOrder: IGetMyOrder,
        @Inject(CANCEL_MY_ORDER) private readonly cancelMyOrder: ICancelMyOrder,
    ) {
    }


    @Post()
    @UseGuards(CSRFGuard, JwtSessionGuard)
    async placeController(
        @Body(new ZodValidationPipe(PlaceOrderSchema)) body: PlaceOrderBody,
        @Headers() headers: Record<string, string | undefined>,
        @ReqUser() user: User,
    ) {
        const idempotencyKey = new ZodValidationPipe(IdempotencyKeySchema)
            .transform(headers['idempotency-key'])

        if (typeof idempotencyKey !== 'string') {
            throw new ValidationError({
                message: 'errors.order.invalidIdempotencyKey',
                code: 'ORDER_INVALID_IDEMPOTENCY_KEY',
            })
        }

        const order = await this.placeOrder.execute(
            {...body, idempotencyKey},
            user.id,
        )
        return new SuccessResponse({
            messageObj: {message: 'common.order.placeSuccess'},
            code: 'ORDER_PLACE_SUCCESS',
            path: '/orders',
            status: HttpStatus.CREATED,
            data: OrderPresenter.detail(order),
        })
    }

    @Get()
    @UseGuards(JwtSessionGuard)
    async listController(
        @Query(new ZodValidationPipe(ListMyOrdersQuerySchema)) query: ListMyOrdersQuery,
        @ReqUser() user: User,
    ) {
        const page = await this.listMyOrders.execute(user.id, query)
        return new SuccessResponse({
            messageObj: {message: 'common.order.listSuccess'},
            code: 'ORDER_LIST_SUCCESS',
            path: '/orders',
            data: {items: page.orders.map(OrderPresenter.summary), nextCursor: page.nextCursor},
        })
    }

    @Get(':id')
    @UseGuards(JwtSessionGuard)
    async getController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        const order = await this.getMyOrder.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.order.getSuccess'},
            code: 'ORDER_GET_SUCCESS',
            path: `/orders/${id}`,
            data: OrderPresenter.detail(order),
        })
    }

    @Post(':id/cancel')
    @UseGuards(CSRFGuard, JwtSessionGuard)
    async cancelController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        const order = await this.cancelMyOrder.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.order.cancelSuccess'},
            code: 'ORDER_CANCEL_SUCCESS',
            path: `/orders/${id}/cancel`,
            data: OrderPresenter.detail(order),
        })
    }
}
