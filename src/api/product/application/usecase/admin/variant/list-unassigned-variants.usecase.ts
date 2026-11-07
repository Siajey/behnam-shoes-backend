import { IVariantRepository, UnassignedVariantsCriteria, Variant } from '@api/product/domain'

import { IListUnassignedVariants } from '../../../interfaces'

export default class ListUnassignedVariantsUseCase implements IListUnassignedVariants {
    constructor(private readonly variants: IVariantRepository) {}

    execute(query: UnassignedVariantsCriteria): Promise<{ variants: Variant[]; nextCursor: string | null }> {
        return this.variants.findUnassigned(query)
    }
}