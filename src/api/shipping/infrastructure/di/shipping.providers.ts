import {
    CONFIG_PROVIDER,
    CREATE_SHIPPING_METHOD,
    createProvider,
    DELETE_SHIPPING_METHOD,
    EDIT_SHIPPING_METHOD,
    GET_SHIPMENTS_BY_ORDER_IDS,
    GET_SHIPPING_METHOD,
    LIST_DELIVERED_ORDER_IDS,
    LIST_SHIPPING_METHODS,
    LIST_SHIPPING_OPTIONS,
    POLL_SHIPMENTS,
    QUOTE_SHIPPING,
    REFRESH_SHIPMENT,
    REGISTER_SHIPMENT,
    SHIPMENT_REPOSITORY,
    SHIPMENT_TRACKER,
    SHIPPING_CARRIER_REGISTRY,
    SHIPPING_CHECKOUT_PARCELS,
    SHIPPING_DESTINATIONS,
    SHIPPING_METHOD_REPOSITORY,
    SHIPPING_ORIGIN,
    SHIPPING_PARCEL_ESTIMATOR,
    SHIPPING_QUOTE_CACHE,
    SHIPPING_QUOTER,
} from '@common/di'

import {
    CreateShippingMethodUseCase,
    DeleteShippingMethodUseCase,
    EditShippingMethodUseCase,
    GetShipmentsByOrderIdsUseCase,
    GetShippingMethodUseCase,
    ListDeliveredOrderIdsUseCase,
    ListShippingMethodsUseCase,
    ListShippingOptionsUseCase,
    PollShipmentsUseCase,
    QuoteShippingUseCase,
    RefreshShipmentUseCase,
    RegisterShipmentUseCase,
    ShipmentTracker,
    ShippingQuoter,
} from '@api/shipping/application'

export const ShippingUseCaseProviders = [
    createProvider<ShippingQuoter>(SHIPPING_QUOTER, ShippingQuoter, [
        SHIPPING_CARRIER_REGISTRY, SHIPPING_QUOTE_CACHE, SHIPPING_ORIGIN,
    ]),
    createProvider<ListShippingOptionsUseCase>(LIST_SHIPPING_OPTIONS, ListShippingOptionsUseCase, [
        SHIPPING_METHOD_REPOSITORY, SHIPPING_DESTINATIONS, SHIPPING_CHECKOUT_PARCELS,
        SHIPPING_PARCEL_ESTIMATOR, SHIPPING_QUOTER,
    ]),
    createProvider<QuoteShippingUseCase>(QUOTE_SHIPPING, QuoteShippingUseCase, [
        SHIPPING_METHOD_REPOSITORY, SHIPPING_PARCEL_ESTIMATOR, SHIPPING_QUOTER,
    ]),
    createProvider<ListShippingMethodsUseCase>(LIST_SHIPPING_METHODS, ListShippingMethodsUseCase, [
        SHIPPING_METHOD_REPOSITORY,
    ]),
    createProvider<GetShippingMethodUseCase>(GET_SHIPPING_METHOD, GetShippingMethodUseCase, [
        SHIPPING_METHOD_REPOSITORY,
    ]),
    createProvider<CreateShippingMethodUseCase>(CREATE_SHIPPING_METHOD, CreateShippingMethodUseCase, [
        SHIPPING_METHOD_REPOSITORY, SHIPPING_CARRIER_REGISTRY,
    ]),
    createProvider<EditShippingMethodUseCase>(EDIT_SHIPPING_METHOD, EditShippingMethodUseCase, [
        SHIPPING_METHOD_REPOSITORY, SHIPPING_CARRIER_REGISTRY,
    ]),
    createProvider<DeleteShippingMethodUseCase>(DELETE_SHIPPING_METHOD, DeleteShippingMethodUseCase, [
        SHIPPING_METHOD_REPOSITORY,
    ]),

    createProvider(SHIPMENT_TRACKER, ShipmentTracker, [
        SHIPMENT_REPOSITORY, SHIPPING_CARRIER_REGISTRY, CONFIG_PROVIDER,
    ]),
    createProvider(REGISTER_SHIPMENT, RegisterShipmentUseCase, [
        SHIPPING_METHOD_REPOSITORY, SHIPMENT_REPOSITORY, SHIPPING_CARRIER_REGISTRY,
    ]),
    createProvider(GET_SHIPMENTS_BY_ORDER_IDS, GetShipmentsByOrderIdsUseCase, [
        SHIPMENT_REPOSITORY, SHIPPING_CARRIER_REGISTRY,
    ]),
    createProvider(LIST_DELIVERED_ORDER_IDS, ListDeliveredOrderIdsUseCase, [
        SHIPMENT_REPOSITORY,
    ]),
    createProvider(REFRESH_SHIPMENT, RefreshShipmentUseCase, [
        SHIPMENT_REPOSITORY, SHIPPING_CARRIER_REGISTRY, SHIPMENT_TRACKER,
    ]),
    createProvider(POLL_SHIPMENTS, PollShipmentsUseCase, [
        SHIPMENT_REPOSITORY, SHIPPING_CARRIER_REGISTRY, SHIPMENT_TRACKER, CONFIG_PROVIDER,
    ]),
]
