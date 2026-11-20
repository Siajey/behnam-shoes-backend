export const ATTRIBUTE_TYPES = ['text', 'number', 'boolean', 'select', 'multi_select'] as const
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number]

export const isChoiceType = (type: AttributeType): boolean =>
    type === 'select' || type === 'multi_select'

export const MAX_ATTRIBUTE_TEXT_LENGTH = 500
export const MAX_MULTI_SELECT_OPTIONS = 20

export type AttributeValue =
    | { definitionId: string; type: 'text'; text: string }
    | { definitionId: string; type: 'number'; number: number }
    | { definitionId: string; type: 'boolean'; boolean: boolean }
    | { definitionId: string; type: 'select'; optionId: string }
    | { definitionId: string; type: 'multi_select'; optionIds: string[] }

export interface AttributeValueInput {
    key: string
    value: string | number | boolean | string[]
}

export interface ResolvedOption {
    value: string
    label: string
}

export interface ResolvedAttribute {
    key: string
    name: string
    type: AttributeType
    unit: string | null
    value: string | number | boolean | ResolvedOption | ResolvedOption[]
}