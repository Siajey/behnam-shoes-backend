import {
    ADMIN_GET_ORDER,
    ADMIN_LIST_ORDERS,
    createProvider,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY, ORDER_SHIPMENTS,
    UPDATE_ORDER_STATUS,
} from '@common/di'

import {
    AdminGetOrderUseCase, AdminListOrdersUseCase, UpdateOrderStatusUseCase,
} from '@api/order/application'

export const OrderAdminUseCaseProviders = [
    createProvider<AdminListOrdersUseCase>(ADMIN_LIST_ORDERS, AdminListOrdersUseCase, [ORDER_REPOSITORY]),
    createProvider<AdminGetOrderUseCase>(ADMIN_GET_ORDER, AdminGetOrderUseCase, [ORDER_REPOSITORY,ORDER_SHIPMENTS]),
    createProvider<UpdateOrderStatusUseCase>(UPDATE_ORDER_STATUS, UpdateOrderStatusUseCase, [
        ORDER_REPOSITORY, ORDER_PROMOTIONS,ORDER_SHIPMENTS
    ]),
]
