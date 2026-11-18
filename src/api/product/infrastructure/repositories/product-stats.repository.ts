import { IProductStatsRepository, ProductStatsRow, ProductTagFlags } from '@api/product/domain'
import { Inject, Injectable } from '@nestjs/common'
import { inArray } from 'drizzle-orm'

import {  Database } from '@common/db'
import { DATABASE } from '@common/di'
import * as schema from '../models/product.model'

const CHUNK_SIZE = 500

@Injectable()
export class ProductStatsRepository implements IProductStatsRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

    replaceAll(rows: readonly ProductStatsRow[]): Promise<void> {
        return this.db.transaction(async (tx) => {
            const existing = new Set(
                rows.length
                    ? (
                        await tx
                            .select({ id: schema.products.id })
                            .from(schema.products)
                            .where(inArray(schema.products.id, rows.map((r) => r.productId)))
                    ).map((r) => r.id)
                    : [],
            )
            const valid = rows.filter((r) => existing.has(r.productId))

            await tx.delete(schema.productStats)
            for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
                await tx.insert(schema.productStats).values(
                    valid.slice(i, i + CHUNK_SIZE).map((r) => ({
                        productId: r.productId,
                        unitsSold: r.unitsSold,
                        favoritesAdded: r.favoritesAdded,
                        isBestSeller: r.isBestSeller,
                        isPopular: r.isPopular,
                    })),
                )
            }
        })
    }

    async findFlagsByProductIds(productIds: string[]): Promise<Map<string, ProductTagFlags>> {
        if (productIds.length === 0) return new Map()

        const rows = await this.db
            .select({
                productId: schema.productStats.productId,
                isBestSeller: schema.productStats.isBestSeller,
                isPopular: schema.productStats.isPopular,
            })
            .from(schema.productStats)
            .where(inArray(schema.productStats.productId, productIds))

        return new Map(
            rows.map((r) => [r.productId, { isBestSeller: r.isBestSeller, isPopular: r.isPopular }]),
        )
    }
}