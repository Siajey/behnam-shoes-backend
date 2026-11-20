import { AttributeDefinition, ResolvedAttribute } from '@api/product/domain'

export class AttributePresenter {
  static definition(d: AttributeDefinition) {
    return {
      id: d.id,
      key: d.key,
      name: d.name,
      type: d.type,
      productType: d.productType,
      unit: d.unit,
      isVisible: d.isVisible,
      isFilterable: d.isFilterable,
      position: d.position,
      options: d.options.map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
        position: o.position,
      })),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }
  }

  static resolved(a: ResolvedAttribute) {
    return { key: a.key, name: a.name, type: a.type, unit: a.unit, value: a.value }
  }
}
