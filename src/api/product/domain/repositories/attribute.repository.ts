import { AttributeDefinition } from '../entities'
import { AttributeValue } from '../value-objects'

export interface IAttributeDefinitionRepository {
  findById(id: string): Promise<AttributeDefinition | null>
  keyExists(key: string): Promise<boolean>
  findAll(): Promise<AttributeDefinition[]>
  save(definition: AttributeDefinition): Promise<void>
  delete(id: string): Promise<void>
  isInUse(definitionId: string): Promise<boolean>
  findOptionsInUse(optionIds: string[]): Promise<string[]>
}

export interface IProductAttributeRepository {
  findByProductId(productId: string): Promise<AttributeValue[]>
  replace(productId: string, values: readonly AttributeValue[]): Promise<void>
}
