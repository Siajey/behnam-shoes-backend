import {Module} from '@nestjs/common'

import {AuthModule} from '@api/auth'
import {CartModule} from '@api/cart/cart.module'
import {UserModule} from '@api/users'
import {SessionModule} from '@api/session'
import {DatabaseModule} from '@common/db'
import {
    GET_SHIPMENTS_BY_ORDER_IDS, LIST_DELIVERED_ORDER_IDS,
    QUOTE_SHIPPING, REGISTER_SHIPMENT,
    SHIPMENT_REPOSITORY,
    SHIPPING_CARRIER_REGISTRY,
    SHIPPING_CARRIERS,
    SHIPPING_CHECKOUT_PARCELS,
    SHIPPING_DESTINATIONS,
    SHIPPING_METHOD_REPOSITORY,
    SHIPPING_ORIGIN,
    SHIPPING_PARCEL_ESTIMATOR,
    SHIPPING_QUOTE_CACHE,
} from '@common/di'

import {IShippingCarrier} from './application'
import {
    CartCheckoutParcels,
    ConfigParcelEstimator,
    ConfigShippingOrigin,
    InMemoryQuoteCache,
    IranPostCarrier,
    PollShipmentsJob,
    ProfileShippingDestinations,
    RateTableCarrier,
    ShipmentRepository,
    ShippingCarrierRegistry,
    ShippingMethodRepository,
    ShippingUseCaseProviders,
    TipaxCarrier,
} from './infrastructure'
import {AdminShipmentController, AdminShippingMethodController, ShippingController} from './presentation'

@Module({
    imports: [DatabaseModule, CartModule, UserModule, SessionModule, AuthModule],
    controllers: [ShippingController, AdminShippingMethodController, AdminShipmentController],
    providers: [
        RateTableCarrier,
        TipaxCarrier,
        IranPostCarrier,
        {
            provide: SHIPPING_CARRIERS,
            inject: [RateTableCarrier, TipaxCarrier, IranPostCarrier],
            useFactory: (rateTable: RateTableCarrier, tipax: TipaxCarrier, iranPost: IranPostCarrier) => [
                rateTable, tipax, iranPost,
            ],
        },
        {
            provide: SHIPPING_CARRIER_REGISTRY,
            inject: [SHIPPING_CARRIERS],
            useFactory: (carriers: IShippingCarrier[]) => new ShippingCarrierRegistry(carriers),
        },
        {provide: SHIPPING_METHOD_REPOSITORY, useClass: ShippingMethodRepository},
        {provide: SHIPPING_QUOTE_CACHE, useClass: InMemoryQuoteCache},
        {provide: SHIPPING_ORIGIN, useClass: ConfigShippingOrigin},
        {provide: SHIPPING_PARCEL_ESTIMATOR, useClass: ConfigParcelEstimator},
        {provide: SHIPPING_CHECKOUT_PARCELS, useClass: CartCheckoutParcels},
        {provide: SHIPPING_DESTINATIONS, useClass: ProfileShippingDestinations},
        {provide: SHIPMENT_REPOSITORY, useClass: ShipmentRepository},
        PollShipmentsJob,
        ...ShippingUseCaseProviders,
    ],
    exports: [QUOTE_SHIPPING, REGISTER_SHIPMENT, GET_SHIPMENTS_BY_ORDER_IDS, LIST_DELIVERED_ORDER_IDS],
})
export class ShippingModule {
}