import { inArray } from 'drizzle-orm'
import { Database } from '@common/db'

import { Product,Variant } from '@api/product/domain'

import { ProductMapper } from '../mappers/product.mapper'
import { VariantMapper } from '../mappers/variant.mapper'
import * as schema from '../models'

export type Executor = Pick<Database<typeof schema>, 'select'>

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>()
    for (const item of items) {
        const k = key(item)
        map.set(k, [...(map.get(k) ?? []), item])
    }
    return map
}

export async function hydrateProducts(
    db: Executor,
    rows: (typeof schema.products.$inferSelect)[],
): Promise<Product[]> {
    if (rows.length === 0) return []
    const ids = rows.map((r) => r.id)

    const [imageRows, shoeRows] = await Promise.all([
        db.select().from(schema.productImages).where(inArray(schema.productImages.productId, ids)),
        db.select().from(schema.shoeProductDetails).where(inArray(schema.shoeProductDetails.productId, ids)),
    ])

    const imagesByProduct = groupBy(imageRows, (i) => i.productId)
    const shoeByProduct = new Map(shoeRows.map((s) => [s.productId, s]))

    return rows.map((r) =>
        ProductMapper.toDomain(r, imagesByProduct.get(r.id) ?? [], shoeByProduct.get(r.id) ?? null),
    )
}

export async function hydrateVariants(
    db: Executor,
    rows: (typeof schema.variants.$inferSelect)[],
): Promise<Variant[]> {
    if (rows.length === 0) return []
    const attributeRows = await db
        .select()
        .from(schema.variantAttributes)
        .where(inArray(schema.variantAttributes.variantId, rows.map((r) => r.id)))

    const byVariant = groupBy(attributeRows, (a) => a.variantId)
    return rows.map((r) => VariantMapper.toDomain(r, byVariant.get(r.id) ?? []))
}

export async function loadVariantsByProductIds(
    db: Executor,
    productIds: string[],
): Promise<Map<string, Variant[]>> {
    if (productIds.length === 0) return new Map()
    const rows = await db
        .select()
        .from(schema.variants)
        .where(inArray(schema.variants.productId, productIds))
    const variants = await hydrateVariants(db, rows)
    return groupBy(variants, (v) => v.productId as string)
}