import {AttributeDefinition, IAttributeDefinitionRepository} from '@api/product/domain'
import {Inject, Injectable} from '@nestjs/common'
import {and, asc, eq, inArray, notInArray, sql} from 'drizzle-orm'

import {Database} from '@common/db'
import {CATALOG_CACHE, DATABASE} from '@common/di'

import * as schema from '../models/attribute.model'
import {AttributeMapper} from '../mappers'
import {CatalogCache} from "../cache";


@Injectable()
export class AttributeDefinitionRepository implements IAttributeDefinitionRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
        @Inject(CATALOG_CACHE) private readonly catalogCache: CatalogCache,
    ) {
    }

    async findById(id: string): Promise<AttributeDefinition | null> {
        const [row] = await this.db
            .select()
            .from(schema.attributeDefinitions)
            .where(eq(schema.attributeDefinitions.id, id))
            .limit(1)
        return row ? (await this.hydrate([row]))[0] : null
    }

    async keyExists(key: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.attributeDefinitions.id})
            .from(schema.attributeDefinitions)
            .where(eq(schema.attributeDefinitions.key, key))
            .limit(1)
        return !!row
    }

    async findAll(): Promise<AttributeDefinition[]> {
        const rows = await this.db
            .select()
            .from(schema.attributeDefinitions)
            .orderBy(asc(schema.attributeDefinitions.position), asc(schema.attributeDefinitions.name))
        return this.hydrate(rows)
    }

    async save(definition: AttributeDefinition): Promise<void> {
        const {definition: row, options} = AttributeMapper.definitionToPersistence(definition)
        const {id, ...rest} = row
        const o = schema.attributeOptions

        await this.db.transaction(async (tx) => {
            await tx
                .insert(schema.attributeDefinitions)
                .values(row)
                .onConflictDoUpdate({target: schema.attributeDefinitions.id, set: rest})

            const keep = options.map((x) => x.id as string)
            await tx
                .delete(o)
                .where(
                    keep.length
                        ? and(eq(o.definitionId, id as string), notInArray(o.id, keep))
                        : eq(o.definitionId, id as string),
                )

            if (options.length > 0) {
                await tx
                    .insert(o)
                    .values(options)
                    .onConflictDoUpdate({
                        target: o.id,
                        set: {
                            label: sql`excluded
                            .
                            label`, position: sql`excluded
                            .
                            position`
                        },
                    })
            }
        })
        await this.catalogCache.invalidate()

    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.attributeDefinitions).where(eq(schema.attributeDefinitions.id, id))
        await this.catalogCache.invalidate()

    }

    async isInUse(definitionId: string): Promise<boolean> {
        const [row] = await this.db
            .select({id: schema.productAttributeValues.id})
            .from(schema.productAttributeValues)
            .where(eq(schema.productAttributeValues.definitionId, definitionId))
            .limit(1)
        return !!row
    }

    async findOptionsInUse(optionIds: string[]): Promise<string[]> {
        if (optionIds.length === 0) return []
        const rows = await this.db
            .selectDistinct({optionId: schema.productAttributeValues.optionId})
            .from(schema.productAttributeValues)
            .where(inArray(schema.productAttributeValues.optionId, optionIds))
        return rows.flatMap((r) => (r.optionId ? [r.optionId] : []))
    }

    private async hydrate(
        rows: (typeof schema.attributeDefinitions.$inferSelect)[],
    ): Promise<AttributeDefinition[]> {
        if (rows.length === 0) return []
        const optionRows = await this.db
            .select()
            .from(schema.attributeOptions)
            .where(inArray(schema.attributeOptions.definitionId, rows.map((r) => r.id)))

        const byDefinition = new Map<string, (typeof optionRows)[number][]>()
        for (const option of optionRows) {
            byDefinition.set(option.definitionId, [...(byDefinition.get(option.definitionId) ?? []), option])
        }
        return rows.map((r) => AttributeMapper.definitionToDomain(r, byDefinition.get(r.id) ?? []))
    }
}
