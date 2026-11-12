import {Cart} from "@api/cart/domain";

import { cartItems, carts } from '../models'

export class CartMapper {
    static toDomain(row: typeof carts.$inferSelect, items: (typeof cartItems.$inferSelect)[]): Cart {
        return Cart.restore({
            id: row.id,
            userId: row.userId,
            couponCode: row.couponCode,
            version: row.version,
            items: items
                .map((i) => ({ variantId: i.variantId, quantity: i.quantity, addedAt: new Date(i.addedAt) }))
                .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime()),
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(cart: Cart): {
        cart: typeof carts.$inferInsert
        items: (typeof cartItems.$inferInsert)[]
    } {
        return {
            cart: {
                id: cart.id,
                userId: cart.userId,
                couponCode: cart.couponCode,
                version: cart.version + 1,
                createdAt: cart.createdAt,
                updatedAt: cart.updatedAt,
            },
            items: cart.items.map((i) => ({
                cartId: cart.id,
                variantId: i.variantId,
                quantity: i.quantity,
                addedAt: i.addedAt,
            })),
        }
    }
}