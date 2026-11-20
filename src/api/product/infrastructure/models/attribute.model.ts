import { ATTRIBUTE_TYPES } from '@api/product/domain'
import { commonTimestamps } from '@common/db'
import { sql } from 'drizzle-orm'
import {
  boolean, check, doublePrecision, index, integer, pgEnum, pgTable, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { products, productTypeEnum } from './product.model'

export const attributeTypeEnum = pgEnum('attribute_type', ATTRIBUTE_TYPES)

export const attributeDefinitions = pgTable(
  'attribute_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 40 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: attributeTypeEnum('type').notNull(),
    productType: productTypeEnum('product_type'),
    unit: varchar('unit', { length: 20 }),
    isVisible: boolean('is_visible').notNull().default(true),
    isFilterable: boolean('is_filterable').notNull().default(false),
    position: integer('position').notNull().default(0),
    ...commonTimestamps,
  },
  (t) => [
    uniqueIndex('attribute_definitions_key_uq').on(t.key),
    index('attribute_definitions_position_idx').on(t.position),
  ],
)

export const attributeOptions = pgTable(
  'attribute_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('attribute_options_definition_value_uq').on(t.definitionId, t.value)],
)

export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: 'restrict' }),
    optionId: uuid('option_id').references(() => attributeOptions.id, { onDelete: 'restrict' }),
    textValue: varchar('text_value', { length: 500 }),
    numberValue: doublePrecision('number_value'),
    booleanValue: boolean('boolean_value'),
  },
  (t) => [
    uniqueIndex('product_attribute_values_single_uq')
      .on(t.productId, t.definitionId)
      .where(sql`${t.optionId} is null`),
    uniqueIndex('product_attribute_values_option_uq')
      .on(t.productId, t.definitionId, t.optionId)
      .where(sql`${t.optionId} is not null`),
    index('product_attribute_values_definition_option_idx').on(t.definitionId, t.optionId),
    check(
      'product_attribute_values_one_value',
      sql`num_nonnulls(${t.optionId}, ${t.textValue}, ${t.numberValue}, ${t.booleanValue}) = 1`,
    ),
  ],
)
