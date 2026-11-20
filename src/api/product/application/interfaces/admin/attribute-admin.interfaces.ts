import {
    AttributeDefinition,
    AttributeOptionInput,
    AttributeValueInput,
    NewAttributeDefinitionInput,
    ProductType,
    ResolvedAttribute,
} from '@api/product/domain'

export type CreateAttributeCommand = NewAttributeDefinitionInput

export interface EditAttributeCommand {
    id: string
    name?: string
    unit?: string | null
    productType?: ProductType | null
    isVisible?: boolean
    isFilterable?: boolean
    position?: number
    options?: AttributeOptionInput[]
}

export interface SetProductAttributesCommand {
    productId: string
    values: AttributeValueInput[]
}

export interface IListAttributes {
    execute(): Promise<AttributeDefinition[]>
}

export interface IGetAttribute {
    execute(id: string): Promise<AttributeDefinition>
}

export interface ICreateAttribute {
    execute(command: CreateAttributeCommand, actorId: string): Promise<AttributeDefinition>
}

export interface IEditAttribute {
    execute(command: EditAttributeCommand, actorId: string): Promise<AttributeDefinition>
}

export interface IDeleteAttribute {
    execute(id: string, actorId: string): Promise<void>
}

export interface ISetProductAttributes {
    execute(command: SetProductAttributesCommand, actorId: string): Promise<ResolvedAttribute[]>
}

export interface IGetProductAttributes {
    execute(productId: string): Promise<ResolvedAttribute[]>
}
