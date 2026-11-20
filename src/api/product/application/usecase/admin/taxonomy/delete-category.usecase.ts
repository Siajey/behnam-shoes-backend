import {
    CategoryHasChildrenError,
    CategoryHasProductsError,
    CategoryNotFoundError,
    ICategoryRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'
import {IFileStorage} from "@common/storage";

import { IDeleteCategory } from '../../../interfaces'

export default class DeleteCategoryUseCase implements IDeleteCategory {
    constructor(
        private readonly categories: ICategoryRepository,
        private readonly storage: IFileStorage,
        private readonly logger: ILogger,
    ) {}

    async execute(id: string, actorId: string): Promise<void> {
        const category = await this.categories.findById(id)

        if (!category) throw new CategoryNotFoundError({ id })
        if (await this.categories.hasChildren(id)) throw new CategoryHasChildrenError()
        if (await this.categories.hasProducts(id)) throw new CategoryHasProductsError()

        if(category?.imageKey){
            await this.storage.delete([category.imageKey])
        }

        await this.categories.delete(id)

        void this.logger.info('Category deleted', {
            module: 'DeleteCategoryUseCase',
            operation: 'execute',
            event: 'category.delete',
            userId: actorId,
            resourceId: id,
        })
    }
}