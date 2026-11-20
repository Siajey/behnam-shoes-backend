import { Brand,Category } from '@api/product/domain'

import { brands } from '../models/brand.model'
import { categories } from '../models/category.model'

export class CategoryMapper {
    static toDomain(row: typeof categories.$inferSelect): Category {
        return Category.restore({
            id: row.id,
            name: row.name,
            slug: row.slug,
            parentId: row.parentId,
            sortOrder: row.sortOrder,
            imageKey: row.imageKey,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(c: Category): typeof categories.$inferInsert {
        return {
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
            sortOrder: c.sortOrder,
            imageKey: c.imageKey,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }
    }
}

export class BrandMapper {
    static toDomain(row: typeof brands.$inferSelect): Brand {
        return Brand.restore({
            id: row.id,
            name: row.name,
            slug: row.slug,
            logoKey: row.logoKey,
            imageKey: row.imageKey,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        })
    }

    static toPersistence(b: Brand): typeof brands.$inferInsert {
        return {
            id: b.id,
            name: b.name,
            slug: b.slug,
            logoKey: b.logoKey,
            imageKey: b.imageKey,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
        }
    }
}