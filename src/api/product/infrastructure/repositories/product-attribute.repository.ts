import {AttributeValue, IProductAttributeRepository} from '@api/product/domain'
import {Inject, Injectable} from '@nestjs/common'
import {eq} from 'drizzle-orm'

import {Database} from '@common/db'
import {CATALOG_CACHE, DATABASE} from '@common/di'

import * as schema from '../models/attribute.model'
import {AttributeMapper} from '../mappers'
import {CatalogCache} from "../cache";


@Injectable()
export class ProductAttributeRepository implements IProductAttributeRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
        @Inject(CATALOG_CACHE) private readonly catalogCache: CatalogCache,
    ) {
    }

    async findByProductId(productId: string): Promise<AttributeValue[]> {
        const v = schema.productAttributeValues
        const rows = await this.db
            .select({
                definitionId: v.definitionId,
                type: schema.attributeDefinitions.type,
                optionId: v.optionId,
                text: v.textValue,
                number: v.numberValue,
                boolean: v.booleanValue,
            })
            .from(v)
            .innerJoin(schema.attributeDefinitions, eq(v.definitionId, schema.attributeDefinitions.id))
            .where(eq(v.productId, productId))

        return AttributeMapper.valuesFromRows(rows)
    }

    async replace(productId: string, values: readonly AttributeValue[]): Promise<void> {
        const rows = AttributeMapper.valuesToRows(productId, values)

        await this.db.transaction(async (tx) => {
            await tx
                .delete(schema.productAttributeValues)
                .where(eq(schema.productAttributeValues.productId, productId))
            if (rows.length > 0) await tx.insert(schema.productAttributeValues).values(rows)
        })
        await this.catalogCache.invalidate()

    }
}
