import {
    AttributeDefinition,
    AttributeKeyAlreadyExistsError,
    IAttributeDefinitionRepository,
} from '@api/product/domain'
import {ILogger} from '@common/logger'

import {
    CreateAttributeCommand,
    ICreateAttribute
} from '../../../interfaces'

export default class CreateAttributeUseCase implements ICreateAttribute {
    constructor(
        private readonly definitions: IAttributeDefinitionRepository,
        private readonly logger: ILogger,
    ) {
    }

    async execute(command: CreateAttributeCommand, actorId: string): Promise<AttributeDefinition> {
        const key = command.key.trim()
        if (await this.definitions.keyExists(key)) throw new AttributeKeyAlreadyExistsError(key)

        const definition = AttributeDefinition.create(command)
        await this.definitions.save(definition)

        void this.logger.info('Attribute created', {
            module: 'CreateAttributeUseCase',
            operation: 'execute',
            event: 'attribute.create',
            userId: actorId,
            resourceId: definition.id,
        })
        return definition
    }
}
