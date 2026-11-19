import {
  AttributeDefinition, AttributeDefinitionNotFoundError, AttributeOptionInUseError,
  IAttributeDefinitionRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { EditAttributeCommand, IEditAttribute } from '../../../interfaces'

export default class EditAttributeUseCase implements IEditAttribute {
  constructor(
    private readonly definitions: IAttributeDefinitionRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: EditAttributeCommand, actorId: string): Promise<AttributeDefinition> {
    const definition = await this.definitions.findById(command.id)
    if (!definition) throw new AttributeDefinitionNotFoundError({ id: command.id })

    const { id: _id, options, ...changes } = command
    definition.update(changes)

    if (options !== undefined) {
      const removed = definition.syncOptions(options)
      if (removed.length > 0) {
        const inUse = await this.definitions.findOptionsInUse(removed)
        if (inUse.length > 0) throw new AttributeOptionInUseError(inUse)
      }
    }

    await this.definitions.save(definition)

    void this.logger.info('Attribute updated', {
      module: 'EditAttributeUseCase',
      operation: 'execute',
      event: 'attribute.update',
      userId: actorId,
      resourceId: definition.id,
    })
    return definition
  }
}
