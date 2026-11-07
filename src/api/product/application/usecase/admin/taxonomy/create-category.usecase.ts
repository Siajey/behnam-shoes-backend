import {
    Category,
    CategoryNotFoundError,
    CategorySlugAlreadyExistsError,
    ICategoryRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { CreateCategoryInput, ICreateCategory } from '../../interfaces'

export default class CreateCategoryUseCase implements ICreateCategory {
    constructor(
        private readonly categories: ICategoryRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(input: CreateCategoryInput, actorId: string): Promise<Category> {
        if (await this.categories.findBySlug(input.slug)) {
            throw new CategorySlugAlreadyExistsError(input.slug)
        }
        if (input.parentId && !(await this.categories.findById(input.parentId))) {
            throw new CategoryNotFoundError({ id: input.parentId })
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