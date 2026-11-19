import {
  IAttributeDefinitionRepository, IProductAttributeRepository, IProductRepository,
  ProductNotFoundError, ResolvedAttribute,
} from '@api/product/domain'

import { resolveProductAttributes } from '../../../helpers'
import { IGetProductAttributes } from '../../../interfaces'

export default class GetProductAttributesUseCase implements IGetProductAttributes {
  constructor(
    private readonly products: IProductRepository,
    private readonly definitions: IAttributeDefinitionRepository,
    private readonly values: IProductAttributeRepository,
  ) {}

  async execute(productId: string): Promise<ResolvedAttribute[]> {
    if (!(await this.products.findById(productId))) throw new ProductNotFoundError({ id: productId })
    return resolveProductAttributes(this.definitions, this.values, productId, false)
  }
}
