import {
    ADD_CART_ITEM,
    CART_PRICING_SERVICE,
    CART_REPOSITORY,
    CART_VARIANT_CATALOG,
    CLEAR_CART,
    createProvider,
    GET_CART,
    MERGE_CART,
    REMOVE_CART_ITEM,
    SET_CART_ITEM_QUANTITY,
} from '@common/di'

import {
    AddCartItemUseCase,
    ClearCartUseCase,
    GetCartUseCase,
    MergeCartUseCase,
    RemoveCartItemUseCase,
    SetCartItemQuantityUseCase,
} from '@api/cart/application'

const deps = [CART_REPOSITORY, CART_VARIANT_CATALOG, CART_PRICING_SERVICE]

export const CartUserUseCaseProviders = [
    createProvider<GetCartUseCase>(GET_CART, GetCartUseCase, deps),
    createProvider<AddCartItemUseCase>(ADD_CART_ITEM, AddCartItemUseCase, deps),
    createProvider<SetCartItemQuantityUseCase>(SET_CART_ITEM_QUANTITY, SetCartItemQuantityUseCase, deps),
    createProvider<RemoveCartItemUseCase>(REMOVE_CART_ITEM, RemoveCartItemUseCase, deps),
    createProvider<ClearCartUseCase>(CLEAR_CART, ClearCartUseCase, deps),
    createProvider<MergeCartUseCase>(MERGE_CART, MergeCartUseCase, deps),
]