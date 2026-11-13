import {Inject, Injectable} from '@nestjs/common'
import {
    and,
    eq,
    exists,
    getTableColumns,
    gte,
    ilike,
    inArray,
    isNotNull,
    lte,
    or,
    SQL,
    sql,
} from 'drizzle-orm'

import {Database, DrizzleGetItemsQueryBuilder} from '@common/db'
import {DATABASE} from '@common/di'
import {
    CatalogFilters,
    IProductQueryRepository,
    PRODUCT_FILTER_FIELDS,
    PRODUCT_SORT_FIELDS,
    ProductListCriteria,
    ProductPage,
    ProductSearchCriteria,
    ProductStatus,
    ProductWithVariants
} from '@api/product/domain'
import {hydrateProducts, loadVariantsByProductIds} from './product-hydration'

import * as schema from '../models'
import {normalizePersianLetters, normalizeText} from "@common/util"

@Injectable()
export class ProductQueryRepository implements IProductQueryRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    findAll(criteria: ProductListCriteria): Promise<ProductPage> {
        return this.list(criteria)
    }

    search(criteria: ProductSearchCriteria): Promise<ProductPage> {
        return this.list(criteria, criteria.q)
    }

    async findDetailsById(id: string, statuses: ProductStatus[]) {
        return this.findOne(eq(schema.products.id, id), statuses)
    }

    async findDetailsBySlug(slug: string, statuses: ProductStatus[]) {
        return this.findOne(eq(schema.products.slug, slug), statuses)
    }

    async findPublishedIds(ids: string[]): Promise<string[]> {
        if (ids.length === 0) return []
        const rows = await this.db
            .select({ id: schema.products.id })
            .from(schema.products)
            .where(and(inArray(schema.products.id, ids), eq(schema.products.status, 'published')))
        return rows.map((r) => r.id)
    }

    async findDetailsByIds(ids: string[], statuses: ProductStatus[]): Promise<ProductWithVariants[]> {
        if (ids.length === 0) return []
        const rows = await this.db
            .select()
            .from(schema.products)
            .where(and(inArray(schema.products.id, ids), inArray(schema.products.status, statuses)))
        return this.assemble(rows)
    }

    async getFilters(
        criteria: Pick<ProductListCriteria, 'statuses' | 'categoryId'>,
    ): Promise<CatalogFilters> {
        const p = schema.products
        const scope = await this.scope(criteria.statuses, criteria.categoryId)
        const agg = this.variantAggregates()
        const count = sql<number>`count(distinct
        ${p.id}
        )`.mapWith(Number)

        const [categoryRows, brandRows, [range], attributeRows] = await Promise.all([
            this.db
                .select({id: schema.categories.id, name: schema.categories.name, slug: schema.categories.slug, count})
                .from(p)
                .innerJoin(schema.categories, eq(p.categoryId, schema.categories.id))
                .where(scope)
                .groupBy(schema.categories.id),
            this.db
                .select({id: schema.brands.id, name: schema.brands.name, slug: schema.brands.slug, count})
                .from(p)
                .innerJoin(schema.brands, eq(p.brandId, schema.brands.id))
                .where(scope)
                .groupBy(schema.brands.id),
            this.db
                .select({
                    min: sql<number | null>`min(
                    ${agg.minPrice}
                    )`.mapWith(Number),
                    max: sql<number | null>`max(
                    ${agg.maxPrice}
                    )`.mapWith(Number),
                })
                .from(p)
                .innerJoin(agg, eq(agg.productId, p.id))
                .where(scope),
            this.db
                .select({
                    name: schema.variantAttributes.name,
                    value: schema.variantAttributes.value,
                    count: sql<number>`count(distinct
                    ${schema.variants.productId}
                    )`.mapWith(Number),
                })
                .from(schema.variantAttributes)
                .innerJoin(schema.variants, eq(schema.variantAttributes.variantId, schema.variants.id))
                .innerJoin(p, eq(schema.variants.productId, p.id))
                .where(and(eq(schema.variants.isActive, true), scope))
                .groupBy(schema.variantAttributes.name, schema.variantAttributes.value),
        ])

        const attributes = new Map<string, { value: string; count: number }[]>()
        for (const r of attributeRows) {
            attributes.set(r.name, [...(attributes.get(r.name) ?? []), {value: r.value, count: r.count}])
        }

        return {
            categories: categoryRows,
            brands: brandRows,
            priceRange: range?.min != null && range?.max != null ? {min: range.min, max: range.max} : null,
            attributes: [...attributes].map(([name, values]) => ({name, values})),
        }
    }

    private async list(criteria: ProductListCriteria, q?: string): Promise<ProductPage> {
        const agg = this.variantAggregates()
        const minPrice = sql<number>`coalesce(
        ${agg.minPrice},
        0
        )`.mapWith(Number)
        const maxPrice = sql<number>`coalesce(
        ${agg.maxPrice},
        0
        )`.mapWith(Number)

        const builder = new DrizzleGetItemsQueryBuilder(
            criteria,
            schema.products,
            PRODUCT_FILTER_FIELDS,
            PRODUCT_SORT_FIELDS,
        )
            .withVirtualColumns({
                minPrice: {expr: minPrice, dataType: 'number'},
                maxPrice: {expr: maxPrice, dataType: 'number'},
            })
            .filter()
            .sort()
            .cursor()
            .pagination()

        const extra: (SQL | undefined)[] = [
            await this.scope(criteria.statuses, criteria.categoryId),
            criteria.minPrice !== undefined ? gte(maxPrice, criteria.minPrice) : undefined,
            criteria.maxPrice !== undefined ? lte(minPrice, criteria.maxPrice) : undefined,
            criteria.inStock !== undefined
                ? eq(sql<boolean>`coalesce(
                    ${agg.inStock},
                    false
                    )`, criteria.inStock)
                : undefined,
            this.attributeCondition(criteria.attributes),
            q ? this.searchCondition(q) : undefined,
        ]

        const rows = await this.db
            .select({...getTableColumns(schema.products), minPrice, maxPrice})
            .from(schema.products)
            .leftJoin(agg, eq(agg.productId, schema.products.id))
            .where(and(builder.buildWhere(), ...extra))
            .orderBy(...builder.orderBy)
            .limit(builder.pageSize + 1)

        const hasMore = rows.length > builder.pageSize
        const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows
        const last = pageRows[pageRows.length - 1]
        const nextCursor =
            hasMore && last
                ? DrizzleGetItemsQueryBuilder.encodeCursor(
                    (last as Record<string, unknown>)[builder.sortField],
                    last.id,
                )
                : null

        return {products: await this.assemble(pageRows), nextCursor}
    }

    private async findOne(condition: SQL, statuses: ProductStatus[]) {
        const [row] = await this.db
            .select()
            .from(schema.products)
            .where(and(condition, inArray(schema.products.status, statuses)))
            .limit(1)
        return row ? ((await this.assemble([row]))[0] ?? null) : null
    }

    private async assemble(rows: (typeof schema.products.$inferSelect)[]): Promise<ProductWithVariants[]> {
        const products = await hydrateProducts(this.db, rows)
        const variants = await loadVariantsByProductIds(this.db, products.map((p) => p.id))
        return products.map((p) => new ProductWithVariants(p, variants.get(p.id) ?? []))
    }

    private variantAggregates() {
        const v = schema.variants
        return this.db
            .select({
                productId: v.productId,
                minPrice: sql<number | null>`min(
                ${v.price}
                )
                filter
                (
                where
                ${v.isActive}
                )`.as('min_price'),
                maxPrice: sql<number | null>`max(
                ${v.price}
                )
                filter
                (
                where
                ${v.isActive}
                )`.as('max_price'),
                inStock: sql<boolean>`bool_or
                (
                ${v.isActive}
                and
                ${v.stock}
                >
                0
                )`.as('in_stock'),
            })
            .from(v)
            .where(isNotNull(v.productId))
            .groupBy(v.productId)
            .as('variant_agg')
    }

    private async scope(statuses: ProductStatus[], categoryId?: string): Promise<SQL | undefined> {
        const categoryIds = categoryId ? await this.categoryWithDescendants(categoryId) : null
        return and(
            inArray(schema.products.status, statuses),
            categoryIds ? inArray(schema.products.categoryId, categoryIds) : undefined,
        )
    }

    private async categoryWithDescendants(id: string): Promise<string[]> {
        const rows = await this.db
            .select({id: schema.categories.id, parentId: schema.categories.parentId})
            .from(schema.categories)

        const children = new Map<string, string[]>()
        for (const r of rows) {
            if (r.parentId) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r.id])
        }
        const result = [id]
        for (let i = 0; i < result.length; i++) result.push(...(children.get(result[i]) ?? []))
        return result
    }

    private attributeCondition(attributes?: Record<string, string[]>): SQL | undefined {
        const entries = Object.entries(attributes ?? {}).filter(([, values]) => values.length > 0)
        if (entries.length === 0) return undefined

        const a = schema.variantAttributes
        const perAttribute = entries.map(([name, values]) =>
            exists(
                this.db
                    .select({one: sql`1`})
                    .from(a)
                    .where(
                        and(
                            eq(a.variantId, schema.variants.id),
                            eq(a.name, normalizeText(name)),
                            inArray(a.value, values.map(normalizeText)),
                        ),
                    ),
            ),
        )

        return exists(
            this.db
                .select({one: sql`1`})
                .from(schema.variants)
                .where(
                    and(
                        eq(schema.variants.productId, schema.products.id),
                        eq(schema.variants.isActive, true),
                        ...perAttribute,
                    ),
                ),
        )
    }

    private searchCondition(q: string): SQL | undefined {
        const escaped = normalizePersianLetters(q.trim()).replace(/[\\%_]/g, '\\$&')
        const pattern = `%${escaped}%`
        return or(ilike(schema.products.name, pattern), ilike(schema.products.slug, pattern))
    }
}