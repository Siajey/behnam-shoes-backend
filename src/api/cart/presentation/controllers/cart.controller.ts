import {Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put} from '@nestjs/common'


import {User} from '@api/users/domain'
import {ReqUser} from '@common/decorator'
import {
    ADD_CART_ITEM, APPLY_CART_COUPON,
    CLEAR_CART,
    GET_CART,
    MERGE_CART, REMOVE_CART_COUPON,
    REMOVE_CART_ITEM,
    SET_CART_ITEM_QUANTITY,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from '@common/api'
import {
    IAddCartItem, IApplyCartCoupon,
    IClearCart,
    IGetCart,
    IMergeCart, IRemoveCartCoupon,
    IRemoveCartItem,
    ISetCartItemQuantity,
} from '@api/cart/application'

import {UserOnly} from '../decorators'
import {
    AddCartItemBody,
    AddCartItemSchema, ApplyCouponBody, ApplyCouponSchema,
    MergeCartBody,
    MergeCartSchema,
    SetCartItemQuantityBody,
    SetCartItemQuantitySchema,
} from '../dtos'
import {CartPresenter} from '../presenters'

const variantIdPipe = new ZodValidationPipe(uuidSchema)

@Controller('cart')
@UserOnly()
export default class CartController {
    constructor(
        @Inject(GET_CART) private readonly getCart: IGetCart,
        @Inject(ADD_CART_ITEM) private readonly addItem: IAddCartItem,
        @Inject(SET_CART_ITEM_QUANTITY) private readonly setQuantity: ISetCartItemQuantity,
        @Inject(REMOVE_CART_ITEM) private readonly removeItem: IRemoveCartItem,
        @Inject(CLEAR_CART) private readonly clearCart: IClearCart,
        @Inject(MERGE_CART) private readonly mergeCart: IMergeCart,
        @Inject(APPLY_CART_COUPON) private readonly applyCoupon: IApplyCartCoupon,
        @Inject(REMOVE_CART_COUPON) private readonly removeCoupon: IRemoveCartCoupon,
    ) {
    }

    @Get()
    async getController(@ReqUser() user: User) {
        return new SuccessResponse({
            messageObj: {message: 'common.cart.getSuccess'},
            code: 'CART_GET_SUCCESS',
            path: '/cart',
            data: CartPresenter.toResponse(await this.getCart.execute(user.id)),
        })
    }

    @Post('items')
    async addItemController(
        @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemBody,
        @ReqUser() user: User,
    ) {
        const view = await this.addItem.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.cart.addItemSuccess'},
            code: 'CART_ADD_ITEM_SUCCESS',
            path: '/cart/items',
            data: CartPresenter.toResponse(view),
        })
    }

    @Patch('items/:variantId')
    async setQuantityController(
        @Param('variantId', variantIdPipe) variantId: string,
        @Body(new ZodValidationPipe(SetCartItemQuantitySchema)) body: SetCartItemQuantityBody,
        @ReqUser() user: User,
    ) {
        const view = await this.setQuantity.execute({variantId, quantity: body.quantity}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.cart.updateItemSuccess'},
            code: 'CART_UPDATE_ITEM_SUCCESS',
            path: `/cart/items/${variantId}`,
            data: CartPresenter.toResponse(view),
        })
    }

    @Delete('items/:variantId')
    async removeItemController(
        @Param('variantId', variantIdPipe) variantId: string,
        @ReqUser() user: User,
    ) {
        const view = await this.removeItem.execute(variantId, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.cart.removeItemSuccess'},
            code: 'CART_REMOVE_ITEM_SUCCESS',
            path: `/cart/items/${variantId}`,
            data: CartPresenter.toResponse(view),
        })
    }

    @Delete()
    async clearController(@ReqUser() user: User) {
        return new SuccessResponse({
            messageObj: {message: 'common.cart.clearSuccess'},
            code: 'CART_CLEAR_SUCCESS',
            path: '/cart',
            data: CartPresenter.toResponse(await this.clearCart.execute(user.id)),
        })
    }

    @Post('merge')
    async mergeController(
        @Body(new ZodValidationPipe(MergeCartSchema)) body: MergeCartBody,
        @ReqUser() user: User,
    ) {
        const result = await this.mergeCart.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.cart.mergeSuccess'},
            code: 'CART_MERGE_SUCCESS',
            path: '/cart/merge',
            data: {
                cart: CartPresenter.toResponse(result.cart),
                skippedVariantIds: result.skippedVariantIds,
            },
        })
    }


    @Put('coupon')
    async applyCouponController(
        @Body(new ZodValidationPipe(ApplyCouponSchema)) body: ApplyCouponBody,
        @ReqUser() user: User,
    ) {
        const view = await this.applyCoupon.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.cart.applyCouponSuccess'},
            code: 'CART_APPLY_COUPON_SUCCESS',
            path: '/cart/coupon',
            data: CartPresenter.toResponse(view),
        })
    }

    @Delete('coupon')
    async removeCouponController(@ReqUser() user: User) {
        return new SuccessResponse({
            messageObj: {message: 'common.cart.removeCouponSuccess'},
            code: 'CART_REMOVE_COUPON_SUCCESS',
            path: '/cart/coupon',
            data: CartPresenter.toResponse(await this.removeCoupon.execute(user.id)),
        })
    }
}