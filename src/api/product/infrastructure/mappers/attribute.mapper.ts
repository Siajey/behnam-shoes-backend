import { AttributeDefinition, AttributeValue } from '@api/product/domain'

import { attributeDefinitions, attributeOptions, productAttributeValues } from '../models'

export interface StoredValueRow {
  definitionId: string
  type: (typeof attributeDefinitions.$inferSelect)['type']
  optionId: string | null
  text: string | null
  number: number | null
  boolean: boolean | null
}

export class AttributeMapper {
  static definitionToDomain(
    row: typeof attributeDefinitions.$inferSelect,
    options: (typeof attributeOptions.$inferSelect)[],
  ): AttributeDefinition {
    return AttributeDefinition.restore({
      id: row.id,
      key: row.key,
      name: row.name,
      type: row.type,
      productType: row.productType,
      unit: row.unit,
      isVisible: row.isVisible,
      isFilterable: row.isFilterable,
      position: row.position,
      options: options
        .map((o) => ({ id: o.id, value: o.value, label: o.label, position: o.position }))
        .sort((a, b) => a.position - b.position),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    })
  }

  static definitionToPersistence(d: AttributeDefinition): {
    definition: typeof attributeDefinitions.$inferInsert
    options: (typeof attributeOptions.$inferInsert)[]
  } {
    return {
      definition: {
        id: d.id,
        key: d.key,
        name: d.name,
        type: d.type,
        productType: d.productType,
        unit: d.unit,
        isVisible: d.isVisible,
        isFilterable: d.isFilterable,
        position: d.position,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      },
      options: d.options.map((o) => ({
        id: o.id,
        definitionId: d.id,
        value: o.value,
        label: o.label,
        position: o.position,
      })),
    }
  }

  static valuesFromRows(rows: readonly StoredValueRow[]): AttributeValue[] {
    const groups = new Map<string, StoredValueRow[]>()
    for (const row of rows) groups.set(row.definitionId, [...(groups.get(row.definitionId) ?? []), row])

    return [...groups.values()].flatMap((group): AttributeValue[] => {
      const first = group[0]
      const definitionId = first.definitionId

      switch (first.type) {
        case 'text':
          return first.text !== null ? [{ definitionId, type: 'text', text: first.text }] : []
        case 'number':
          return first.number !== null ? [{ definitionId, type: 'number', number: first.number }] : []
        case 'boolean':
          return first.boolean !== null ? [{ definitionId, type: 'boolean', boolean: first.boolean }] : []
        case 'select':
          return first.optionId ? [{ definitionId, type: 'select', optionId: first.optionId }] : []
        case 'multi_select':
          return [
            {
              definitionId,
              type: 'multi_select',
              optionIds: group.flatMap((r) => (r.optionId ? [r.optionId] : [])),
            },
          ]
      }
    })
  }

    static valuesToRows(
        productId: string,
        values: readonly AttributeValue[],
    ): (typeof productAttributeValues.$inferInsert)[] {
        return values.flatMap((v): (typeof productAttributeValues.$inferInsert)[] => {
            const base = { productId, definitionId: v.definitionId }
            switch (v.type) {
                case 'text':
                    return [{ ...base, textValue: v.text }]
                case 'number':
                    return [{ ...base, numberValue: v.number }]
                case 'boolean':
                    return [{ ...base, booleanValue: v.boolean }]
                case 'select':
                    return [{ ...base, optionId: v.optionId }]
                case 'multi_select':
                    return v.optionIds.map((optionId) => ({ ...base, optionId }))
            }
        })
    }

}
