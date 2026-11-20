import {BrandHasProductsError, BrandNotFoundError, IBrandRepository} from '@api/product/domain'
import {ILogger} from '@common/logger'
import {IFileStorage} from "@common/storage";

import {IDeleteBrand} from '../../../interfaces'

export default class DeleteBrandUseCase implements IDeleteBrand {
    constructor(
        private readonly brands: IBrandRepository,
        private readonly storage: IFileStorage,
        private readonly logger: ILogger,
    ) {
    }

    async execute(id: string, actorId: string): Promise<void> {
        const brand = await this.brands.findById(id)

        if (!brand) throw new BrandNotFoundError({id})
        if (await this.brands.hasProducts(id)) throw new BrandHasProductsError()

        const filesToDelete: string[] = []
        if (brand.logoKey) {
            filesToDelete.push(brand.logoKey)
        }
        if (brand.imageKey) {
            filesToDelete.push(brand.imageKey)
        }
        if(filesToDelete.length > 0){
            await this.storage.delete(filesToDelete)
        }

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