import {Inject, Injectable} from '@nestjs/common'
import {asc, eq} from 'drizzle-orm'

import {Database} from '@common/db'
import {CATALOG_CACHE, DATABASE} from '@common/di'
import {Brand, Category, IBrandRepository, ICategoryRepository} from '@api/product/domain'

import {BrandMapper, CategoryMapper} from '../mappers/taxonomy.mapper'
import * as schema from '../models'
import {CatalogCache} from "../cache";


@Injectable()
export class CategoryRepository implements ICategoryRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
        @Inject(CATALOG_CACHE) private readonly catalogCache: CatalogCache,
    ) {
    }

    async findById(id: string): Promise<Category | null> {
        const [row] = await this.db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1)
        return row ? CategoryMapper.toDomain(row) : null
    }

    async findBySlug(slug: string): Promise<Category | null> {
        const [row] = await this.db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1)
        return row ? CategoryMapper.toDomain(row) : null
    }

    async findAll(): Promise<Category[]> {
        const rows = await this.db
            .select()
            .from(schema.categories)
            .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name))
        return rows.map(CategoryMapper.toDomain)
    }

    async hasChildren(id: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.categories.id})
            .from(schema.categories)
            .where(eq(schema.categories.parentId, id))
            .limit(1)
        return !!row
    }

    async hasProducts(id: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.products.id})
            .from(schema.products)
            .where(eq(schema.products.categoryId, id))
            .limit(1)
        return !!row
    }

    async save(category: Category): Promise<void> {
        const {id, ...rest} = CategoryMapper.toPersistence(category)
        await this.db
            .insert(schema.categories)
            .values({id, ...rest})
            .onConflictDoUpdate({target: schema.categories.id, set: rest})
        await this.catalogCache.invalidate()
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.categories).where(eq(schema.categories.id, id))
        await this.catalogCache.invalidate()
    }
}

@Injectable()
export class BrandRepository implements IBrandRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
        @Inject(CATALOG_CACHE) private readonly catalogCache: CatalogCache,
    ) {
    }

    async findById(id: string): Promise<Brand | null> {
        const [row] = await this.db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1)
        return row ? BrandMapper.toDomain(row) : null
    }

    async findBySlug(slug: string): Promise<Brand | null> {
        const [row] = await this.db.select().from(schema.brands).where(eq(schema.brands.slug, slug)).limit(1)
        return row ? BrandMapper.toDomain(row) : null
    }

    async findAll(): Promise<Brand[]> {
        const rows = await this.db.select().from(schema.brands).orderBy(asc(schema.brands.name))
        return rows.map(BrandMapper.toDomain)
    }

    async hasProducts(id: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.products.id})
            .from(schema.products)
            .where(eq(schema.products.brandId, id))
            .limit(1)
        return !!row
    }

    async save(brand: Brand): Promise<void> {
        const {id, ...rest} = BrandMapper.toPersistence(brand)
        await this.db
            .insert(schema.brands)
            .values({id, ...rest})
            .onConflictDoUpdate({target: schema.brands.id, set: rest})
        await this.catalogCache.invalidate()

    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.brands).where(eq(schema.brands.id, id))
        await this.catalogCache.invalidate()
    }
}