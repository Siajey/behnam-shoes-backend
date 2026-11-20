import {
  AttributeDefinition, AttributeDefinitionNotFoundError, IAttributeDefinitionRepository,
} from '@api/product/domain'

import { IGetAttribute } from '../../../interfaces'

export default class GetAttributeUseCase implements IGetAttribute {
  constructor(private readonly definitions: IAttributeDefinitionRepository) {}

  async execute(id: string): Promise<AttributeDefinition> {
    const definition = await this.definitions.findById(id)
    if (!definition) throw new AttributeDefinitionNotFoundError({ id })
    return definition
  }
}
