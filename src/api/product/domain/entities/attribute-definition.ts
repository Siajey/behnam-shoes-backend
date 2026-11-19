import { randomUUID } from 'node:crypto'

import { InvalidAttributeDefinitionError } from '../errors'
import { AttributeType, isChoiceType, ProductType } from '../value-objects'

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/
const OPTION_VALUE_PATTERN = /^[\p{L}\p{N}_-]{1,50}$/u

export interface AttributeOption {
    id: string
    value: string
    label: string
    position: number
}

export interface AttributeOptionInput {
    id?: string
    value: string
    label: string
}

export interface AttributeDefinitionProps {
    id: string
    key: string
    name: string
    type: AttributeType
    productType: ProductType | null
    unit: string | null
    isVisible: boolean
    isFilterable: boolean
    position: number
    options: AttributeOption[]
    createdAt: Date
    updatedAt: Date
}

export interface NewAttributeDefinitionInput {
    key: string
    name: string
    type: AttributeType
    productType?: ProductType | null
    unit?: string | null
    isVisible?: boolean
    isFilterable?: boolean
    position?: number
    options?: AttributeOptionInput[]
}

export interface AttributeDefinitionChanges {
    name?: string
    unit?: string | null
    productType?: ProductType | null
    isVisible?: boolean
    isFilterable?: boolean
    position?: number
}

export class AttributeDefinition {
    private constructor(private props: AttributeDefinitionProps) {}

    static create(input: NewAttributeDefinitionInput): AttributeDefinition {
        const key = input.key.trim()
        if (!KEY_PATTERN.test(key)) throw new InvalidAttributeDefinitionError('key')

        const now = new Date()
        const definition = new AttributeDefinition({
            id: randomUUID(),
            key,
            name: '',
            type: input.type,
            productType: null,
            unit: null,
            isVisible: true,
            isFilterable: false,
            position: 0,
            options: [],
            createdAt: now,
            updatedAt: now,
        })

        definition.update({
            name: input.name,
            unit: input.unit ?? null,
            productType: input.productType ?? null,
            isVisible: input.isVisible ?? true,
            isFilterable: input.isFilterable ?? false,
            position: input.position ?? 0,
        })
        definition.syncOptions(input.options ?? [])
        return definition
    }

    static restore(props: AttributeDefinitionProps): AttributeDefinition {
        return new AttributeDefinition(props)
    }

    get id() { return this.props.id }
    get key() { return this.props.key }
    get name() { return this.props.name }
    get type() { return this.props.type }
    get productType() { return this.props.productType }
    get unit() { return this.props.unit }
    get isVisible() { return this.props.isVisible }
    get isFilterable() { return this.props.isFilterable }
    get position() { return this.props.position }
    get options(): readonly AttributeOption[] { return this.props.options }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    update(changes: AttributeDefinitionChanges): void {
        const name = changes.name !== undefined ? changes.name.trim() : this.props.name
        const unit = changes.unit !== undefined ? changes.unit?.trim() || null : this.props.unit
        const isFilterable = changes.isFilterable ?? this.props.isFilterable
        const position = changes.position ?? this.props.position

        if (name.length < 1 || name.length > 100) throw new InvalidAttributeDefinitionError('name')
        if (unit !== null && unit.length > 20) throw new InvalidAttributeDefinitionError('unit')
        if (!Number.isInteger(position) || position < 0) throw new InvalidAttributeDefinitionError('position')
        if (isFilterable && this.props.type === 'text') throw new InvalidAttributeDefinitionError('filterable')

        this.props.name = name
        this.props.unit = unit
        this.props.isFilterable = isFilterable
        this.props.position = position
        if (changes.productType !== undefined) this.props.productType = changes.productType
        if (changes.isVisible !== undefined) this.props.isVisible = changes.isVisible
        this.touch()
    }

    syncOptions(inputs: readonly AttributeOptionInput[]): string[] {
        if (inputs.length > 0 && !isChoiceType(this.props.type)) {
            throw new InvalidAttributeDefinitionError('options')
        }

        const existing = new Map(this.props.options.map((o) => [o.id, o]))
        const seenValues = new Set<string>()

        const next = inputs.map((input, position): AttributeOption => {
            const label = input.label.trim()
            if (!OPTION_VALUE_PATTERN.test(input.value) || label.length < 1 || label.length > 100) {
                throw new InvalidAttributeDefinitionError('option')
            }
            if (seenValues.has(input.value)) throw new InvalidAttributeDefinitionError('optionDuplicate')
            seenValues.add(input.value)

            if (input.id) {
                const current = existing.get(input.id)
                if (!current || current.value !== input.value) {
                    throw new InvalidAttributeDefinitionError('optionChanged')
                }
                return { ...current, label, position }
            }
            return { id: randomUUID(), value: input.value, label, position }
        })

        const kept = new Set(next.map((o) => o.id))
        const removed = this.props.options.filter((o) => !kept.has(o.id)).map((o) => o.id)

        this.props.options = next
        this.touch()
        return removed
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}