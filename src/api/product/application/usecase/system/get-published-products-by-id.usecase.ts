import { IProductQueryRepository, ProductWithVariants } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { IGetPublishedProductsByIds } from '../../interfaces/system'

export default class GetPublishedProductsByIdsUseCase implements IGetPublishedProductsByIds {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(ids: string[]): Promise<ProductWithVariants[]> {
        return this.productQuery.findDetailsByIds([...new Set(ids)], PUBLIC_PRODUCT_STATUSES)
    }
}