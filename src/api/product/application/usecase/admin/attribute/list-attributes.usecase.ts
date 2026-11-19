import { AttributeDefinition, IAttributeDefinitionRepository } from '@api/product/domain'

import { IListAttributes } from '../../../interfaces'

export default class ListAttributesUseCase implements IListAttributes {
  constructor(private readonly definitions: IAttributeDefinitionRepository) {}

  execute(): Promise<AttributeDefinition[]> {
    return this.definitions.findAll()
  }
}
