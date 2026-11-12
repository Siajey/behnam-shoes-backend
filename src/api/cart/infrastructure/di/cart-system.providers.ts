import {
    CART_PRICING_SERVICE,
    CART_REPOSITORY,
    CART_VARIANT_CATALOG,
    CLEAR_CART_AFTER_ORDER,
    createProvider,
    GET_CHECKOUT_CART,
} from '@common/di'

import { ClearCartAfterOrderUseCase, GetCheckoutCartUseCase } from '../../application'

export const CartSystemUseCaseProviders = [
    createProvider<GetCheckoutCartUseCase>(GET_CHECKOUT_CART, GetCheckoutCartUseCase, [
        CART_REPOSITORY,
        CART_VARIANT_CATALOG,
        CART_PRICING_SERVICE,
    ]),
    createProvider<ClearCartAfterOrderUseCase>(CLEAR_CART_AFTER_ORDER, ClearCartAfterOrderUseCase, [
        CART_REPOSITORY,
    ]),
]