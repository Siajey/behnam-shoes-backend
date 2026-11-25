import {Module} from '@nestjs/common'

import {CartModule} from '@api/cart/cart.module'
import {DiscountModule} from '@api/discount/discount.module'
import {ProductModule} from '@api/product/product.module'
import {UserModule} from '@api/users'
import {SessionModule} from '@api/session'
import {DatabaseModule} from '@common/db'
import {
    EXPIRE_UNPAID_ORDERS,
    GET_ORDER_PAYMENT_INFO,
    GET_PAYABLE_ORDER,
    GET_PRODUCT_SALES,
    MARK_ORDER_PAID,
    ORDER_CART_GATEWAY,
    ORDER_PROMOTIONS,
    ORDER_REPOSITORY, ORDER_SHIPMENTS,
    ORDER_SHIPPING_DETAILS, ORDER_SHIPPING_QUOTES,
    ORDER_VARIANT_REFS,
} from '@common/di'

import {
    CartCheckoutGateway,
    DiscountPromotions,
    ExpireUnpaidOrdersJob,
    OrderAdminUseCaseProviders,
    OrderRepository,
    OrderSystemUseCaseProviders,
    OrderUserUseCaseProviders,
    ProductVariantRefs,
    ProfileShippingDetails, ShippingModuleQuotes, ShippingModuleShipments, SyncShipmentStatusesJob,
} from './infrastructure'
import {AdminOrderController, OrderController} from './presentation'
import {FilesModule} from "@common/files";
import {ShippingModule} from "@api/shipping/shipping.module";

@Module({
    imports: [
        DatabaseModule,
        FilesModule,
        SessionModule,
        CartModule,
        DiscountModule,
        ProductModule,
        UserModule,
        ShippingModule
    ],
    controllers: [OrderController, AdminOrderController],
    providers: [
        {provide: ORDER_REPOSITORY, useClass: OrderRepository},
        {provide: ORDER_CART_GATEWAY, useClass: CartCheckoutGateway},
        {provide: ORDER_PROMOTIONS, useClass: DiscountPromotions},
        {provide: ORDER_VARIANT_REFS, useClass: ProductVariantRefs},
        {provide: ORDER_SHIPPING_DETAILS, useClass: ProfileShippingDetails},
        {provide: ORDER_SHIPPING_QUOTES, useClass: ShippingModuleQuotes},
        { provide: ORDER_SHIPMENTS, useClass: ShippingModuleShipments },
        SyncShipmentStatusesJob,
        ...OrderUserUseCaseProviders,
        ...OrderAdminUseCaseProviders,
        ...OrderSystemUseCaseProviders,
        ExpireUnpaidOrdersJob,
    ],
    exports: [EXPIRE_UNPAID_ORDERS, GET_ORDER_PAYMENT_INFO, GET_PAYABLE_ORDER, MARK_ORDER_PAID, GET_PRODUCT_SALES],
})
export class OrderModule {
}