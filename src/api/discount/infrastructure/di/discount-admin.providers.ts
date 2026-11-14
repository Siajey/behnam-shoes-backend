import {
    COUPON_REDEMPTION_REPOSITORY, COUPON_REPOSITORY, CREATE_COUPON, CREATE_DISCOUNT, createProvider,
    DELETE_COUPON, DELETE_DISCOUNT, DISCOUNT_REPOSITORY, EDIT_COUPON, EDIT_DISCOUNT, GET_COUPON,
    GET_COUPON_USAGE, GET_DISCOUNT, LIST_COUPONS, LIST_DISCOUNTS,
} from '@common/di'

import {
    CreateCouponUseCase, CreateDiscountUseCase, DeleteCouponUseCase, DeleteDiscountUseCase,
    EditCouponUseCase, EditDiscountUseCase, GetCouponUsageUseCase, GetCouponUseCase,
    GetDiscountUseCase, ListCouponsUseCase, ListDiscountsUseCase,
} from '@api/discount/application'

export const DiscountAdminUseCaseProviders = [
    createProvider<ListDiscountsUseCase>(LIST_DISCOUNTS, ListDiscountsUseCase, [DISCOUNT_REPOSITORY]),
    createProvider<GetDiscountUseCase>(GET_DISCOUNT, GetDiscountUseCase, [DISCOUNT_REPOSITORY]),
    createProvider<CreateDiscountUseCase>(CREATE_DISCOUNT, CreateDiscountUseCase, [DISCOUNT_REPOSITORY]),
    createProvider<EditDiscountUseCase>(EDIT_DISCOUNT, EditDiscountUseCase, [DISCOUNT_REPOSITORY]),
    createProvider<DeleteDiscountUseCase>(DELETE_DISCOUNT, DeleteDiscountUseCase, [DISCOUNT_REPOSITORY]),

    createProvider<ListCouponsUseCase>(LIST_COUPONS, ListCouponsUseCase, [COUPON_REPOSITORY]),
    createProvider<GetCouponUseCase>(GET_COUPON, GetCouponUseCase, [COUPON_REPOSITORY]),
    createProvider<CreateCouponUseCase>(CREATE_COUPON, CreateCouponUseCase, [COUPON_REPOSITORY]),
    createProvider<EditCouponUseCase>(EDIT_COUPON, EditCouponUseCase, [COUPON_REPOSITORY]),
    createProvider<DeleteCouponUseCase>(DELETE_COUPON, DeleteCouponUseCase, [
        COUPON_REPOSITORY, COUPON_REDEMPTION_REPOSITORY,
    ]),
    createProvider<GetCouponUsageUseCase>(GET_COUPON_USAGE, GetCouponUsageUseCase, [
        COUPON_REPOSITORY, COUPON_REDEMPTION_REPOSITORY,
    ]),
]