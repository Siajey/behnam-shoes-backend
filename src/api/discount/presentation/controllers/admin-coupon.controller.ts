import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post, Query} from '@nestjs/common'

import {
    ICreateCoupon, IDeleteCoupon, IEditCoupon, IGetCoupon, IGetCouponUsage, IListCoupons,
} from '@api/discount/application'
import {ReqUser, AdminOnly} from '@common/decorator'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {
    CREATE_COUPON, DELETE_COUPON, EDIT_COUPON, GET_COUPON, GET_COUPON_USAGE, LIST_COUPONS,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {
    CreateCouponBody, CreateCouponSchema, EditCouponBody, EditCouponSchema,
    ListDiscountsQuery, ListDiscountsQuerySchema,
} from '../dto'
import {toListCriteria} from '../mappers'
import {DiscountPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/coupons')
@AdminOnly()
export default class AdminCouponController {
    constructor(
        @Inject(LIST_COUPONS) private readonly listCoupons: IListCoupons,
        @Inject(GET_COUPON) private readonly getCoupon: IGetCoupon,
        @Inject(CREATE_COUPON) private readonly createCoupon: ICreateCoupon,
        @Inject(EDIT_COUPON) private readonly editCoupon: IEditCoupon,
        @Inject(DELETE_COUPON) private readonly deleteCoupon: IDeleteCoupon,
        @Inject(GET_COUPON_USAGE) private readonly getUsage: IGetCouponUsage,
    ) {
    }

    @Get()
    async listController(
        @Query(new ZodValidationPipe(ListDiscountsQuerySchema)) query: ListDiscountsQuery,
    ) {
        const page = await this.listCoupons.execute(toListCriteria(query))
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.listSuccess'},
            code: 'COUPON_LIST_SUCCESS',
            path: '/admin/coupons',
            data: {items: page.coupons.map(DiscountPresenter.coupon), nextCursor: page.nextCursor},
        })
    }

    @Get(':id')
    async getController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.getSuccess'},
            code: 'COUPON_GET_SUCCESS',
            path: `/admin/coupons/${id}`,
            data: DiscountPresenter.coupon(await this.getCoupon.execute(id)),
        })
    }

    @Get(':id/usage')
    async usageController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.usageSuccess'},
            code: 'COUPON_USAGE_SUCCESS',
            path: `/admin/coupons/${id}/usage`,
            data: DiscountPresenter.usage(await this.getUsage.execute(id)),
        })
    }

    @Post()
    async createController(
        @Body(new ZodValidationPipe(CreateCouponSchema)) body: CreateCouponBody,
        @ReqUser() user: User,
    ) {
        const coupon = await this.createCoupon.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.createSuccess'},
            code: 'COUPON_CREATE_SUCCESS',
            path: '/admin/coupons',
            status: HttpStatus.CREATED,
            data: DiscountPresenter.coupon(coupon),
        })
    }

    @Patch(':id')
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditCouponSchema)) body: EditCouponBody,
        @ReqUser() user: User,
    ) {
        const coupon = await this.editCoupon.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.updateSuccess'},
            code: 'COUPON_UPDATE_SUCCESS',
            path: `/admin/coupons/${id}`,
            data: DiscountPresenter.coupon(coupon),
        })
    }

    @Delete(':id')
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteCoupon.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.coupon.deleteSuccess'},
            code: 'COUPON_DELETE_SUCCESS',
            path: `/admin/coupons/${id}`,
            data: null,
        })
    }
}