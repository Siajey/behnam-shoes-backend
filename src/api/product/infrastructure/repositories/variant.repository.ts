import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import {Database, DrizzleGetItemsQueryBuilder} from '@common/db'
import { DATABASE } from '@common/di'
import {
    IVariantRepository, UnassignedVariantsCriteria,Variant
} from '@api/product/domain'

import { Executor, hydrateVariants } from './product-hydration'
import * as schema from '../models'
import { persistVariant } from "./product-persistence"

@Injectable()
export class VariantRepository implements IVariantRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

    async findById(id: string): Promise<Variant | null> {
        return (await this.findMany(eq(schema.variants.id, id)))[0] ?? null
    }

    findByIds(ids: string[]): Promise<Variant[]> {
        return ids.length ? this.findMany(inArray(schema.variants.id, ids)) : Promise.resolve([])
    }

    findByProductId(productId: string): Promise<Variant[]> {
        return this.findMany(eq(schema.variants.productId, productId))
    }

    async findByExternal(source: string, externalId: string): Promise<Variant | null> {
        return (
            (await this.findMany(
                and(eq(schema.variants.source, source), eq(schema.variants.externalId, externalId)),
            ))[0] ?? null
        )
    }

    async findUnassigned(
        criteria: UnassignedVariantsCriteria,
    ): Promise<{ variants: Variant[]; nextCursor: string | null }> {
        const builder = new DrizzleGetItemsQueryBuilder<never, 'createdAt'>(
            criteria,
            schema.variants,
            [],
            ['createdAt'],
        )
            .sort()
            .cursor()
            .pagination()

        const rows = await this.db
            .select()
            .from(schema.variants)
            .where(and(isNull(schema.variants.productId), builder.buildWhere()))
            .orderBy(...builder.orderBy)
            .limit(builder.pageSize + 1)

        const hasMore = rows.length > builder.pageSize
        const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows
        const last = pageRows[pageRows.length - 1]

        return {
            variants: await hydrateVariants(this.db, pageRows),
            nextCursor:
                hasMore && last
                    ? DrizzleGetItemsQueryBuilder.encodeCursor(
                        (last as Record<string, unknown>)[builder.sortField],
                        last.id,
                    )
                    : null,
        }
    }

    private async findMany(condition: ReturnType<typeof eq> | ReturnType<typeof and>): Promise<Variant[]> {
        const rows = await this.db.select().from(schema.variants).where(condition)
        return hydrateVariants(this.db as Executor, rows)
    }

    save(variant: Variant): Promise<void> {
        return this.db.transaction((tx) => persistVariant(tx, variant))
    }

    saveMany(variants: Variant[]): Promise<void> {
        return this.db.transaction(async (tx) => {
            for (const v of variants) await persistVariant(tx, v)
        })
    }

    findByExternalIds(source: string, externalIds: string[]): Promise<Variant[]> {
        if (externalIds.length === 0) return Promise.resolve([])
        return this.findMany(
            and(eq(schema.variants.source, source), inArray(schema.variants.externalId, externalIds)),
        )
    }

    findActiveBySource(source: string): Promise<Variant[]> {
        return this.findMany(and(eq(schema.variants.source, source), eq(schema.variants.isActive, true)))
    }
}