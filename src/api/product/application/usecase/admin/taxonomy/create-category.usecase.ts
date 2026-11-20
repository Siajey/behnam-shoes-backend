import {
    Category,
    CategoryNotFoundError,
    CategorySlugAlreadyExistsError,
    ICategoryRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { CreateCategoryInput, ICreateCategory } from '../../../interfaces'
import {IFileStorage} from "@common/storage";
import {CATEGORY_IMAGE_UPLOAD_POLICY} from "@api/product/application";

export default class CreateCategoryUseCase implements ICreateCategory {
    constructor(
        private readonly categories: ICategoryRepository,
        private readonly storage: IFileStorage,
        private readonly logger: ILogger,
    ) {}

    async execute(input: CreateCategoryInput, actorId: string): Promise<Category> {
        if (await this.categories.findBySlug(input.slug)) {
            throw new CategorySlugAlreadyExistsError(input.slug)
        }
        if (input.parentId && !(await this.categories.findById(input.parentId))) {
            throw new CategoryNotFoundError({ id: input.parentId })
        }

        if (input.imageKey) {
            await this.storage.verifyUploaded(CATEGORY_IMAGE_UPLOAD_POLICY, input.imageKey)
        }

        const category = Category.create(input)
        await this.categories.save(category)

        void this.logger.info('Category created', {
            module: 'CreateCategoryUseCase',
            operation: 'execute',
            event: 'category.create',
            userId: actorId,
            resourceId: category.id,
        })
        return category
    }
}