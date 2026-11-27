import {
    createProvider,
    EXPIRE_UNPAID_ORDERS,
    GET_ORDER_PAYMENT_INFO,
    GET_PAYABLE_ORDER,
    GET_PRODUCT_SALES,
    HAS_PURCHASED_PRODUCT,
    MARK_ORDER_PAID,
    ORDER_CART_GATEWAY,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY,
    ORDER_SHIPMENTS,
    SYNC_SHIPMENT_STATUSES,
} from '@common/di'

import {
    ExpireUnpaidOrdersUseCase,
    GetOrderPaymentInfoUseCase,
    GetPayableOrderUseCase,
    GetProductSalesUseCase,
    HasPurchasedProductUseCase,
    MarkOrderPaidUseCase,
    SyncShipmentStatusesUseCase,
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
    createProvider<GetProductSalesUseCase>(GET_PRODUCT_SALES, GetProductSalesUseCase, [ORDER_REPOSITORY]),
    createProvider<SyncShipmentStatusesUseCase>(SYNC_SHIPMENT_STATUSES, SyncShipmentStatusesUseCase, [ORDER_REPOSITORY, ORDER_SHIPMENTS]),
    createProvider<HasPurchasedProductUseCase>(HAS_PURCHASED_PRODUCT, HasPurchasedProductUseCase, [ORDER_REPOSITORY]),
]
