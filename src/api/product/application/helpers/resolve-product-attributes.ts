import {
  IAttributeDefinitionRepository, IProductAttributeRepository, resolveAttributes, ResolvedAttribute,
} from '@api/product/domain'

export async function resolveProductAttributes(
  definitions: IAttributeDefinitionRepository,
  values: IProductAttributeRepository,
  productId: string,
  visibleOnly: boolean,
): Promise<ResolvedAttribute[]> {
  const [defs, stored] = await Promise.all([definitions.findAll(), values.findByProductId(productId)])
  return resolveAttributes(defs, stored, visibleOnly)
}
