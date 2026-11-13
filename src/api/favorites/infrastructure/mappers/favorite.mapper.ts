import { Favorite } from '@api/favorites/domain'

import { favorites } from '../models'

export class FavoriteMapper {
    static toDomain(row: typeof favorites.$inferSelect): Favorite {
        return Favorite.restore({
            id: row.id,
            userId: row.userId,
            productId: row.productId,
            createdAt: new Date(row.createdAt),
        })
    }

    static toPersistence(f: Favorite): typeof favorites.$inferInsert {
        return {
            id: f.id,
            userId: f.userId,
            productId: f.productId,
            createdAt: f.createdAt,
        }
    }
}