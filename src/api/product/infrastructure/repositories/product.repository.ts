import {Inject, Injectable} from '@nestjs/common'
import {and, eq, ne} from 'drizzle-orm'

import {Database} from '@common/db'
import {CATALOG_CACHE, DATABASE} from "@common/di";
import {IProductRepository, Product, ProductChangeSet} from '@api/product/domain'
import * as schema from '../models'

import {hydrateProducts} from './product-hydration'
import {persistProduct, persistVariant} from "./product-persistence";
import {CatalogCache} from "../cache";

@Injectable()
export class ProductRepository implements IProductRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
        @Inject(CATALOG_CACHE) private readonly catalogCache: CatalogCache,
    ) {
    }

    async findById(id: string): Promise<Product | null> {
        const [row] = await this.db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
        return row ? (await hydrateProducts(this.db, [row]))[0] : null
    }

    async findBySlug(slug: string): Promise<Product | null> {
        const [row] = await this.db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1)
        return row ? (await hydrateProducts(this.db, [row]))[0] : null
    }

    async slugExists(slug: string, excludeId?: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.products.id})
            .from(schema.products)
            .where(and(eq(schema.products.slug, slug), excludeId ? ne(schema.products.id, excludeId) : undefined))
            .limit(1)
        return !!row
    }

    async save(product: Product): Promise<void> {
        await this.db.transaction((tx) => persistProduct(tx, product))
        await this.catalogCache.invalidate()
    }

    async saveChanges(changes: ProductChangeSet): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (const p of changes.products ?? []) await persistProduct(tx, p)
            for (const v of changes.variants ?? []) await persistVariant(tx, v)
        })
        await this.catalogCache.invalidate()
    }
}