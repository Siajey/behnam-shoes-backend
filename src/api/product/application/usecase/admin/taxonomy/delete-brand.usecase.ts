import { BrandHasProductsError, BrandNotFoundError, IBrandRepository } from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IDeleteBrand } from '../../interfaces'

export default class DeleteBrandUseCase implements IDeleteBrand {
    constructor(
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(id: string, actorId: string): Promise<void> {
        if (!(await this.brands.findById(id))) throw new BrandNotFoundError({ id })
        if (await this.brands.hasProducts(id)) throw new BrandHasProductsError()

        await this.brands.delete(id)

        void this.logger.info('Brand deleted', {
            module: 'DeleteBrandUseCase',
            operation: 'execute',
            event: 'brand.delete',
            userId: actorId,
            resourceId: id,
        })
    }
}