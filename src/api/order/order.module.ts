import {Module} from '@nestjs/common'

import {AuthModule} from '@api/auth'
import {CartModule} from '@api/cart/cart.module'
import {DiscountModule} from '@api/discount/discount.module'
import {ProductModule} from '@api/product/product.module'
import {UserModule} from '@api/users'
import {SessionModule} from '@api/session'
import {DatabaseModule} from '@common/db'
import {
    EXPIRE_UNPAID_ORDERS,
    GET_ORDER_PAYMENT_INFO,
    GET_PRODUCT_SALES,
    GET_PAYABLE_ORDER,
    MARK_ORDER_PAID,
    ORDER_CART_GATEWAY,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY,
    ORDER_SHIPPING_CALCULATOR,
    ORDER_SHIPPING_DETAILS,
    ORDER_VARIANT_REFS,
} from '@common/di'

import {
    CartCheckoutGateway, ConfigShippingCalculator, DiscountPromotions, ExpireUnpaidOrdersJob,
    OrderAdminUseCaseProviders, OrderRepository, OrderSystemUseCaseProviders,
    OrderUserUseCaseProviders, ProductVariantRefs, ProfileShippingDetails,
} from './infrastructure'
import {AdminOrderController, OrderController} from './presentation'

@Module({
    imports: [
        DatabaseModule, SessionModule, AuthModule,
        CartModule, DiscountModule, ProductModule, UserModule,
    ],
    controllers: [OrderController, AdminOrderController],
    providers: [
        {provide: ORDER_REPOSITORY, useClass: OrderRepository},
        {provide: ORDER_CART_GATEWAY, useClass: CartCheckoutGateway},
        {provide: ORDER_PROMOTIONS, useClass: DiscountPromotions},
        {provide: ORDER_VARIANT_REFS, useClass: ProductVariantRefs},
        {provide: ORDER_SHIPPING_DETAILS, useClass: ProfileShippingDetails},
        {provide: ORDER_SHIPPING_CALCULATOR, useClass: ConfigShippingCalculator},
        ...OrderUserUseCaseProviders,
        ...OrderAdminUseCaseProviders,
        ...OrderSystemUseCaseProviders,
        ExpireUnpaidOrdersJob,
    ],
    exports: [EXPIRE_UNPAID_ORDERS, GET_ORDER_PAYMENT_INFO, GET_PAYABLE_ORDER, MARK_ORDER_PAID, GET_PRODUCT_SALES],
})
export class OrderModule {
}