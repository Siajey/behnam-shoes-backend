import { ICartRepository } from '@api/cart/domain'

import { withCartRetry } from '../../helpers'
import { IClearCartAfterOrder } from '../../interface'

export default class ClearCartAfterOrderUseCase implements IClearCartAfterOrder {
    constructor(private readonly carts: ICartRepository) {}

    execute(userId: string): Promise<void> {
        return withCartRetry(async () => {
            const cart = await this.carts.findByUserId(userId)
            if (!cart) return
            cart.clear()
            await this.carts.save(cart)
        })
    }
}