import {
    createProvider,
    EXPIRE_UNPAID_ORDERS,
    GET_ORDER_PAYMENT_INFO,
    GET_PAYABLE_ORDER,
    MARK_ORDER_PAID,
    ORDER_CART_GATEWAY,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY,
} from '@common/di'

import {
    ExpireUnpaidOrdersUseCase, GetOrderPaymentInfoUseCase, GetPayableOrderUseCase,
    MarkOrderPaidUseCase,
} from '@api/order/application'

export const OrderSystemUseCaseProviders = [
    createProvider<ExpireUnpaidOrdersUseCase>(EXPIRE_UNPAID_ORDERS, ExpireUnpaidOrdersUseCase, [
        ORDER_REPOSITORY, ORDER_PROMOTIONS,
    ]),
    createProvider<GetOrderPaymentInfoUseCase>(GET_ORDER_PAYMENT_INFO, GetOrderPaymentInfoUseCase, [
        ORDER_REPOSITORY,
    ]),
    createProvider<GetPayableOrderUseCase>(GET_PAYABLE_ORDER, GetPayableOrderUseCase, [ORDER_REPOSITORY]),
    createProvider<MarkOrderPaidUseCase>(MARK_ORDER_PAID, MarkOrderPaidUseCase, [
        ORDER_REPOSITORY, ORDER_PROMOTIONS, ORDER_CART_GATEWAY,
    ]),
]
