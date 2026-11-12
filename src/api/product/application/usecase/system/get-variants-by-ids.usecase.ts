import { IVariantRepository, Variant } from '@api/product/domain'

import { IGetVariantsByIds } from '../../interfaces'

export default class GetVariantsByIdsUseCase implements IGetVariantsByIds {
    constructor(private readonly variants: IVariantRepository) {}

    execute(ids: string[]): Promise<Variant[]> {
        return this.variants.findByIds([...new Set(ids)])
    }
}