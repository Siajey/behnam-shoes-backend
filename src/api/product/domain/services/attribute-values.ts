import { AttributeDefinition } from '../entities'
import {
  AttributeDefinitionNotFoundError, InvalidAttributeValueError,
} from '../errors'
import {
  AttributeValue, AttributeValueInput, MAX_ATTRIBUTE_TEXT_LENGTH, MAX_MULTI_SELECT_OPTIONS,
  ProductType, ResolvedAttribute, ResolvedOption,
} from '../value-objects'

function toValue(definition: AttributeDefinition, raw: AttributeValueInput['value']): AttributeValue {
  const bad = (reason: string) => new InvalidAttributeValueError(definition.key, reason)
  const base = { definitionId: definition.id }

  switch (definition.type) {
    case 'text': {
      if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > MAX_ATTRIBUTE_TEXT_LENGTH) {
        throw bad('text')
      }
      return { ...base, type: 'text', text: raw.trim() }
    }
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) throw bad('number')
      return { ...base, type: 'number', number: raw }
    }
    case 'boolean': {
      if (typeof raw !== 'boolean') throw bad('boolean')
      return { ...base, type: 'boolean', boolean: raw }
    }
    case 'select': {
      const option = typeof raw === 'string' ? definition.options.find((o) => o.value === raw) : undefined
      if (!option) throw bad('option')
      return { ...base, type: 'select', optionId: option.id }
    }
    case 'multi_select': {
      if (!Array.isArray(raw) || raw.length === 0) throw bad('options')
      const values = [...new Set(raw)]
      if (values.length > MAX_MULTI_SELECT_OPTIONS) throw bad('options')

      const optionIds = values.map((v) => {
        const option = definition.options.find((o) => o.value === v)
        if (!option) throw bad('option')
        return option.id
      })
      return { ...base, type: 'multi_select', optionIds }
    }
  }
}

export function validateAttributeValues(
  productType: ProductType,
  definitions: readonly AttributeDefinition[],
  inputs: readonly AttributeValueInput[],
): AttributeValue[] {
  const byKey = new Map(definitions.map((d) => [d.key, d]))
  const seen = new Set<string>()

  return inputs.map((input) => {
    const definition = byKey.get(input.key)
    if (!definition) throw new AttributeDefinitionNotFoundError({ key: input.key })
    if (seen.has(input.key)) throw new InvalidAttributeValueError(input.key, 'duplicate')
    seen.add(input.key)

    if (definition.productType !== null && definition.productType !== productType) {
      throw new InvalidAttributeValueError(input.key, 'productType')
    }
    return toValue(definition, input.value)
  })
}

export function resolveAttributes(
  definitions: readonly AttributeDefinition[],
  values: readonly AttributeValue[],
  visibleOnly: boolean,
): ResolvedAttribute[] {
  const byId = new Map(definitions.map((d) => [d.id, d]))
  const entries: { position: number; attribute: ResolvedAttribute }[] = []

  for (const stored of values) {
    const definition = byId.get(stored.definitionId)
    if (!definition || (visibleOnly && !definition.isVisible)) continue

    const option = (id: string): ResolvedOption | null => {
      const found = definition.options.find((o) => o.id === id)
      return found ? { value: found.value, label: found.label } : null
    }

    let value: ResolvedAttribute['value'] | null
    switch (stored.type) {
      case 'text':
        value = stored.text
        break
      case 'number':
        value = stored.number
        break
      case 'boolean':
        value = stored.boolean
        break
      case 'select':
        value = option(stored.optionId)
        break
      case 'multi_select':
        value = stored.optionIds.map(option).filter((o): o is ResolvedOption => o !== null)
        break
    }
    if (value === null) continue

    entries.push({
      position: definition.position,
      attribute: {
        key: definition.key,
        name: definition.name,
        type: definition.type,
        unit: definition.unit,
        value,
      },
    })
  }

  return entries
    .sort((a, b) => a.position - b.position || a.attribute.name.localeCompare(b.attribute.name))
    .map((e) => e.attribute)
}
