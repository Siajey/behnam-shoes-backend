import {
  IAttributeDefinitionRepository, IProductAttributeRepository, IProductRepository,
  ProductNotFoundError, resolveAttributes, ResolvedAttribute, validateAttributeValues,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { ISetProductAttributes, SetProductAttributesCommand } from '../../../interfaces'

export default class SetProductAttributesUseCase implements ISetProductAttributes {
  constructor(
    private readonly products: IProductRepository,
    private readonly definitions: IAttributeDefinitionRepository,
    private readonly values: IProductAttributeRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SetProductAttributesCommand, actorId: string): Promise<ResolvedAttribute[]> {
    const product = await this.products.findById(command.productId)
    if (!product) throw new ProductNotFoundError({ id: command.productId })

    const definitions = await this.definitions.findAll()
    const values = validateAttributeValues(product.type, definitions, command.values)
    await this.values.replace(product.id, values)

    void this.logger.info('Product attributes updated', {
      module: 'SetProductAttributesUseCase',
      operation: 'execute',
      event: 'product.attributes.update',
      userId: actorId,
      resourceId: product.id,
      data: { count: values.length },
    })
    return resolveAttributes(definitions, values, false)
  }
}
