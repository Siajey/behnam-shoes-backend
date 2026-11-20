import {
    Category,
    CategoryNotFoundError,
    CategorySlugAlreadyExistsError,
    ICategoryRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'
import {IFileStorage} from "@common/storage";

import { EditCategoryInput, IEditCategory } from '../../../interfaces'
import { CATEGORY_IMAGE_UPLOAD_POLICY } from '../../../constants'

export default class EditCategoryUseCase implements IEditCategory {
    constructor(
        private readonly categories: ICategoryRepository,
        private readonly storage: IFileStorage,
        private readonly logger: ILogger,
    ) {}

    async execute(input: EditCategoryInput, actorId: string): Promise<Category> {
        const category = await this.categories.findById(input.id)
        if (!category) throw new CategoryNotFoundError({ id: input.id })

        if (input.slug !== undefined && input.slug !== category.slug) {
            if (await this.categories.findBySlug(input.slug)) {
                throw new CategorySlugAlreadyExistsError(input.slug)
            }
        }

        if (input.parentId !== undefined && input.parentId !== category.parentId) {
            const all = await this.categories.findAll()
            if (input.parentId !== null && !all.some((c) => c.id === input.parentId)) {
                throw new CategoryNotFoundError({ id: input.parentId })
            }
            category.moveTo(input.parentId, all)
        }

        if (input.imageKey && input.imageKey !== category.imageKey) {
            await this.storage.verifyUploaded(CATEGORY_IMAGE_UPLOAD_POLICY, input.imageKey)
        }
        category.update({
            name: input.name, slug: input.slug, sortOrder: input.sortOrder, imageKey: input.imageKey,
        })

        await this.categories.save(category)

        void this.logger.info('Category updated', {
            module: 'EditCategoryUseCase',
            operation: 'execute',
            event: 'category.update',
            userId: actorId,
            resourceId: category.id,
        })
        return category
    }
}