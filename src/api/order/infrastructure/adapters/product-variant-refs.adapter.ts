import { Inject, Injectable } from '@nestjs/common'
import { IGetVariantsByIds } from '@api/product/application'
import { GET_VARIANTS_BY_IDS } from '@common/di'

import { IVariantRefProvider, VariantRef } from '../../application/ports'

@Injectable()
export class ProductVariantRefs implements IVariantRefProvider {
  constructor(@Inject(GET_VARIANTS_BY_IDS) private readonly getVariants: IGetVariantsByIds) {}

  async findByIds(variantIds: string[]): Promise<VariantRef[]> {
    const variants = await this.getVariants.execute(variantIds)
    return variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      source: v.source,
      externalId: v.externalId,
    }))
  }
}
