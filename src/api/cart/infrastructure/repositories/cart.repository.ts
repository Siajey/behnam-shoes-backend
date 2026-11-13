import {and, eq} from 'drizzle-orm'
import {Inject, Injectable} from '@nestjs/common'

import {Database} from '@common/db'
import {DATABASE} from '@common/di'

import * as schema from '../models'

import {Cart, CartVersionConflictError, ICartRepository} from '../../domain'
import {CartMapper} from '../mappers'

@Injectable()
export class CartRepository implements ICartRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async findByUserId(userId: string): Promise<Cart | null> {
        const [row] = await this.db.select().from(schema.carts).where(eq(schema.carts.userId, userId)).limit(1)
        if (!row) return null

        const items = await this.db.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, row.id))
        return CartMapper.toDomain(row, items)
    }

    save(cart: Cart): Promise<void> {
        const {cart: row, items} = CartMapper.toPersistence(cart)

        return this.db.transaction(async (tx) => {
            if (cart.version === 0) {
                const inserted = await tx
                    .insert(schema.carts)
                    .values(row)
                    .onConflictDoNothing()
                    .returning({id: schema.carts.id})
                if (inserted.length === 0) throw new CartVersionConflictError()
            } else {
                const updated = await tx
                    .update(schema.carts)
                    .set({couponCode: row.couponCode, version: row.version, updatedAt: row.updatedAt})
                    .where(and(eq(schema.carts.id, cart.id), eq(schema.carts.version, cart.version)))
                    .returning({id: schema.carts.id})
                if (updated.length === 0) throw new CartVersionConflictError()
            }

            await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id))
            if (items.length) await tx.insert(schema.cartItems).values(items)
        })
    }
}