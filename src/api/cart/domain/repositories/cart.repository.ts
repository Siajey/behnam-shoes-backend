import { Cart } from '../entities'

export interface ICartRepository {
    findByUserId(userId: string): Promise<Cart | null>
    save(cart: Cart): Promise<void>
}