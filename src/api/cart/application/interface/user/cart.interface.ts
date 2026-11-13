import { CartView } from '@api/cart/domain'

export interface AddCartItemCommand {
    variantId: string
    quantity: number
}

export interface SetCartItemQuantityCommand {
    variantId: string
    quantity: number
}

export interface MergeCartCommand {
    items: { variantId: string; quantity: number }[]
}

export interface MergeCartResult {
    cart: CartView
    skippedVariantIds: string[]
}

export interface IGetCart {
    execute(userId: string): Promise<CartView>
}
export interface IAddCartItem {
    execute(command: AddCartItemCommand, userId: string): Promise<CartView>
}
export interface ISetCartItemQuantity {
    execute(command: SetCartItemQuantityCommand, userId: string): Promise<CartView>
}
export interface IRemoveCartItem {
    execute(variantId: string, userId: string): Promise<CartView>
}
export interface IClearCart {
    execute(userId: string): Promise<CartView>
}
export interface IMergeCart {
    execute(command: MergeCartCommand, userId: string): Promise<MergeCartResult>
}