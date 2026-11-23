import {Module} from '@nestjs/common'

import {AuthModule} from '@api/auth'
import {SessionModule} from '@api/session'
import {
    CONFIG_PROVIDER,
    PAYMENT_GATEWAY_REGISTRY,
    PAYMENT_GATEWAYS,
    PAYMENT_ORDERS,
    PAYMENT_REPOSITORY
} from '@common/di'
import {DatabaseModule} from '@common/db'
import {ConfigProvider} from '@common/configuration'

import {OrderModule} from '@api/order/order.module'

import {
    OrderPayments,
    PaymentGatewayRegistry,
    PaymentRepository,
    PaymentUseCaseProviders,
    ReconcilePaymentsJob,
    ZibalGateway
} from './infrastructure'
import {AdminPaymentController, PaymentController} from './presentation'

@Module({
    imports: [DatabaseModule, SessionModule, AuthModule, OrderModule],
    controllers: [PaymentController, AdminPaymentController],
    providers: [
        ZibalGateway,
        {provide: PAYMENT_GATEWAYS, inject: [ZibalGateway], useFactory: (zibal: ZibalGateway) => [zibal]},
        {
            provide: PAYMENT_GATEWAY_REGISTRY,
            inject: [PAYMENT_GATEWAYS, CONFIG_PROVIDER],
            useFactory: (gateways: ZibalGateway[], config: ConfigProvider) => new PaymentGatewayRegistry(gateways, config.getOptional('PAYMENT_DEFAULT_GATEWAY') ?? 'zibal')
        },
        {provide: PAYMENT_REPOSITORY, useClass: PaymentRepository}, {provide: PAYMENT_ORDERS, useClass: OrderPayments},
        ...PaymentUseCaseProviders, ReconcilePaymentsJob,
    ]
})
export class PaymentModule {
}
