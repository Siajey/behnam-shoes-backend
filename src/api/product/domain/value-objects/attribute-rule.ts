export interface AttributeRule {
    name: string
    required: boolean
    validate?: (value: string) => boolean
}