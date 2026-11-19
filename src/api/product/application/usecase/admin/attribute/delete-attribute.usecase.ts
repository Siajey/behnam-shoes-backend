import {
  AttributeDefinitionNotFoundError, AttributeInUseError, IAttributeDefinitionRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IDeleteAttribute } from '../../../interfaces'

export default class DeleteAttributeUseCase implements IDeleteAttribute {
  constructor(
    private readonly definitions: IAttributeDefinitionRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    if (!(await this.definitions.findById(id))) throw new AttributeDefinitionNotFoundError({ id })
    if (await this.definitions.isInUse(id)) throw new AttributeInUseError()

    await this.definitions.delete(id)

    void this.logger.info('Attribute deleted', {
      module: 'DeleteAttributeUseCase',
      operation: 'execute',
      event: 'attribute.delete',
      userId: actorId,
      resourceId: id,
    })
  }
}
