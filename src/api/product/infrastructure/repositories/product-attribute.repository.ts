import { AttributeValue, IProductAttributeRepository } from '@api/product/domain'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import {  Database } from '@common/db'
import { DATABASE } from '@common/di'

import * as schema from '../models/attribute.model'

import { AttributeMapper } from '../mappers'

@Injectable()
export class ProductAttributeRepository implements IProductAttributeRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

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

  replace(productId: string, values: readonly AttributeValue[]): Promise<void> {
    const rows = AttributeMapper.valuesToRows(productId, values)

    return this.db.transaction(async (tx) => {
      await tx
        .delete(schema.productAttributeValues)
        .where(eq(schema.productAttributeValues.productId, productId))
      if (rows.length > 0) await tx.insert(schema.productAttributeValues).values(rows)
    })
  }
}
