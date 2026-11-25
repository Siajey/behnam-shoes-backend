import {
    CANCEL_MY_ORDER,
    CONFIG_PROVIDER,
    createProvider,
    GET_MY_ORDER,
    LIST_MY_ORDERS,
    ORDER_CART_GATEWAY,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY, ORDER_SHIPMENTS,
    ORDER_SHIPPING_DETAILS,
    ORDER_SHIPPING_QUOTES,
    ORDER_VARIANT_REFS,
    PLACE_ORDER,
} from '@common/di'

import {CancelMyOrderUseCase, GetMyOrderUseCase, ListMyOrdersUseCase, PlaceOrderUseCase,} from '@api/order/application'

export const OrderUserUseCaseProviders = [
    createProvider<PlaceOrderUseCase>(PLACE_ORDER, PlaceOrderUseCase, [
        ORDER_REPOSITORY, ORDER_CART_GATEWAY, ORDER_PROMOTIONS, ORDER_VARIANT_REFS,
        ORDER_SHIPPING_DETAILS, ORDER_SHIPPING_QUOTES, CONFIG_PROVIDER,
    ]),
    createProvider<ListMyOrdersUseCase>(LIST_MY_ORDERS, ListMyOrdersUseCase, [ORDER_REPOSITORY]),
    createProvider<GetMyOrderUseCase>(GET_MY_ORDER, GetMyOrderUseCase, [ORDER_REPOSITORY,ORDER_SHIPMENTS]),
    createProvider<CancelMyOrderUseCase>(CANCEL_MY_ORDER, CancelMyOrderUseCase, [
        ORDER_REPOSITORY, ORDER_PROMOTIONS,
    ]),
]
