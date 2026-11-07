import { Inject, Injectable } from '@nestjs/common'
import { and, eq, ne } from 'drizzle-orm'

import {  Database } from '@common/db'
import {DATABASE} from "@common/di";
import { Product,IProductRepository } from '@api/product/domain'
import * as schema from '../models/product.model'

import { ProductMapper } from '../mappers/product.mapper'
import { hydrateProducts } from './product-hydration'

@Injectable()
export class ProductRepository implements IProductRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

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
            .select({ id: schema.products.id })
            .from(schema.products)
            .where(and(eq(schema.products.slug, slug), excludeId ? ne(schema.products.id, excludeId) : undefined))
            .limit(1)
        return !!row
    }

    async save(product: Product): Promise<void> {
        const { product: row, images, shoe } = ProductMapper.toPersistence(product)
        const { id, ...rest } = row

        await this.db.transaction(async (tx) => {
            await tx
                .insert(schema.products)
                .values(row)
                .onConflictDoUpdate({ target: schema.products.id, set: rest })

            await tx.delete(schema.productImages).where(eq(schema.productImages.productId, id as string))
            if (images.length) await tx.insert(schema.productImages).values(images)

            if (shoe) {
                await tx
                    .insert(schema.shoeProductDetails)
                    .values(shoe)
                    .onConflictDoUpdate({
                        target: schema.shoeProductDetails.productId,
                        set: { gender: shoe.gender, material: shoe.material },
                    })
            }
        })
    }
}