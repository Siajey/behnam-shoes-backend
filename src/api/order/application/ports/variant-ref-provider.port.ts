export interface VariantRef {
  id: string
  sku: string
  source: string
  externalId: string
}

export interface IVariantRefProvider {
  findByIds(variantIds: string[]): Promise<VariantRef[]>
}
