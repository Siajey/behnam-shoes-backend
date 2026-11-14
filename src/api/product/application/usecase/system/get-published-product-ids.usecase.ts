import { IProductQueryRepository } from '@api/product/domain'

import { IGetPublishedProductIds } from '../../interfaces/system'

export default class GetPublishedProductIdsUseCase implements IGetPublishedProductIds {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(ids: string[]): Promise<string[]> {
        return this.productQuery.findPublishedIds([...new Set(ids)])
    }
}