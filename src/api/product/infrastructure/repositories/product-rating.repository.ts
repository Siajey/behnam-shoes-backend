import { Inject, Injectable } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'

import { DATABASE} from '@common/di'
import { Database } from '@common/db'
import { IProductRatingRepository, ProductRating } from '@api/product/domain'

import * as schema from '../models'

@Injectable()
export class ProductRatingRepository implements IProductRatingRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

  async upsert(productId: string, average: number, count: number): Promise<void> {
    if (count === 0) {
      await this.db.delete(schema.productRatings).where(eq(schema.productRatings.productId, productId))
      return
    }

    const [product] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1)
    if (!product) return

    const updatedAt = new Date()
    await this.db
      .insert(schema.productRatings)
      .values({ productId, average, count, updatedAt })
      .onConflictDoUpdate({ target: schema.productRatings.productId, set: { average, count, updatedAt } })
  }

  async findByProductIds(productIds: string[]): Promise<Map<string, ProductRating>> {
    if (productIds.length === 0) return new Map()
    const rows = await this.db
      .select()
      .from(schema.productRatings)
      .where(inArray(schema.productRatings.productId, productIds))
    return new Map(rows.map((r) => [r.productId, { average: r.average, count: r.count }]))
  }
}
