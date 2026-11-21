import {
    CONFIG_PROVIDER,
    CONFIRM_PAYMENT,
    createProvider,
    GET_PAYMENT_STATUS,
    HANDLE_PAYMENT_CALLBACK,
    LIST_ORDER_PAYMENTS,
    PAYMENT_GATEWAY_REGISTRY,
    PAYMENT_ORDERS,
    PAYMENT_REPOSITORY,
    RECONCILE_PAYMENTS,
    START_PAYMENT
} from '@common/di'
import {
    ConfirmPaymentUseCase,
    GetPaymentStatusUseCase,
    HandlePaymentCallbackUseCase,
    ListOrderPaymentsUseCase,
    ReconcilePaymentsUseCase,
    StartPaymentUseCase
} from '@api/payment/application'

export const PaymentUseCaseProviders = [
    createProvider<StartPaymentUseCase>(START_PAYMENT, StartPaymentUseCase, [PAYMENT_REPOSITORY, PAYMENT_ORDERS, PAYMENT_GATEWAY_REGISTRY, CONFIG_PROVIDER]),
    createProvider<GetPaymentStatusUseCase>(GET_PAYMENT_STATUS, GetPaymentStatusUseCase, [PAYMENT_REPOSITORY]),
    createProvider<ConfirmPaymentUseCase>(CONFIRM_PAYMENT, ConfirmPaymentUseCase, [PAYMENT_REPOSITORY, PAYMENT_ORDERS, PAYMENT_GATEWAY_REGISTRY]),
    createProvider<HandlePaymentCallbackUseCase>(HANDLE_PAYMENT_CALLBACK, HandlePaymentCallbackUseCase, [PAYMENT_REPOSITORY, PAYMENT_GATEWAY_REGISTRY, CONFIRM_PAYMENT]),
    createProvider<ReconcilePaymentsUseCase>(RECONCILE_PAYMENTS, ReconcilePaymentsUseCase, [PAYMENT_REPOSITORY, CONFIRM_PAYMENT, CONFIG_PROVIDER]),
    createProvider<ListOrderPaymentsUseCase>(LIST_ORDER_PAYMENTS, ListOrderPaymentsUseCase, [PAYMENT_REPOSITORY]),
]
