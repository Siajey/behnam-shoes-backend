import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post, Query} from '@nestjs/common'
import {
    ICreateDiscount, IDeleteDiscount, IEditDiscount, IGetDiscount, IListDiscounts,
} from '@api/discount/application'
import {ReqUser, AdminOnly} from '@common/decorator'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {CREATE_DISCOUNT, DELETE_DISCOUNT, EDIT_DISCOUNT, GET_DISCOUNT, LIST_DISCOUNTS} from '@common/di'

import {
    CreateDiscountBody, CreateDiscountSchema, EditDiscountBody, EditDiscountSchema,
    ListDiscountsQuery, ListDiscountsQuerySchema,
} from '../dto'
import {toListCriteria} from '../mappers'
import {DiscountPresenter} from '../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/discounts')
@AdminOnly()
export default class AdminDiscountController {
    constructor(
        @Inject(LIST_DISCOUNTS) private readonly listDiscounts: IListDiscounts,
        @Inject(GET_DISCOUNT) private readonly getDiscount: IGetDiscount,
        @Inject(CREATE_DISCOUNT) private readonly createDiscount: ICreateDiscount,
        @Inject(EDIT_DISCOUNT) private readonly editDiscount: IEditDiscount,
        @Inject(DELETE_DISCOUNT) private readonly deleteDiscount: IDeleteDiscount,
    ) {
    }

    @Get()
    async listController(
        @Query(new ZodValidationPipe(ListDiscountsQuerySchema)) query: ListDiscountsQuery,
    ) {
        const page = await this.listDiscounts.execute(toListCriteria(query))
        return new SuccessResponse({
            messageObj: {message: 'common.discount.listSuccess'},
            code: 'DISCOUNT_LIST_SUCCESS',
            path: '/admin/discounts',
            data: {items: page.discounts.map(DiscountPresenter.discount), nextCursor: page.nextCursor},
        })
    }

    @Get(':id')
    async getController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj: {message: 'common.discount.getSuccess'},
            code: 'DISCOUNT_GET_SUCCESS',
            path: `/admin/discounts/${id}`,
            data: DiscountPresenter.discount(await this.getDiscount.execute(id)),
        })
    }

    @Post()
    async createController(
        @Body(new ZodValidationPipe(CreateDiscountSchema)) body: CreateDiscountBody,
        @ReqUser() user: User,
    ) {
        const discount = await this.createDiscount.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.discount.createSuccess'},
            code: 'DISCOUNT_CREATE_SUCCESS',
            path: '/admin/discounts',
            status: HttpStatus.CREATED,
            data: DiscountPresenter.discount(discount),
        })
    }

    @Patch(':id')
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditDiscountSchema)) body: EditDiscountBody,
        @ReqUser() user: User,
    ) {
        const discount = await this.editDiscount.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.discount.updateSuccess'},
            code: 'DISCOUNT_UPDATE_SUCCESS',
            path: `/admin/discounts/${id}`,
            data: DiscountPresenter.discount(discount),
        })
    }

    @Delete(':id')
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteDiscount.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.discount.deleteSuccess'},
            code: 'DISCOUNT_DELETE_SUCCESS',
            path: `/admin/discounts/${id}`,
            data: null,
        })
    }
}