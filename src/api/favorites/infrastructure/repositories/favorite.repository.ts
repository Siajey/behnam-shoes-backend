import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'

import { Favorite, IFavoriteRepository } from '@api/favorites/domain'
import { Database } from '@common/db'
import { DATABASE } from '@common/di'

import { FavoriteMapper } from '../mappers'
import * as schema from '../models'

@Injectable()
export class FavoriteRepository implements IFavoriteRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

    async listByUserId(userId: string): Promise<Favorite[]> {
        const rows = await this.db
            .select()
            .from(schema.favorites)
            .where(eq(schema.favorites.userId, userId))
            .orderBy(desc(schema.favorites.createdAt), desc(schema.favorites.id))
        return rows.map(FavoriteMapper.toDomain)
    }

    async add(favorites: Favorite[]): Promise<number> {
        if (favorites.length === 0) return 0
        const inserted = await this.db
            .insert(schema.favorites)
            .values(favorites.map(FavoriteMapper.toPersistence))
            .onConflictDoNothing()
            .returning({ id: schema.favorites.id })
        return inserted.length
    }

    async remove(userId: string, productId: string): Promise<void> {
        await this.db
            .delete(schema.favorites)
            .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.productId, productId)))
    }
}