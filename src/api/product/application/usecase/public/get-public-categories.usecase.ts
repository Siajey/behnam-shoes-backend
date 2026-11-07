import { Category, ICategoryRepository } from '@api/product/domain'

import { IGetPublicCategories } from '../../interfaces'

export default class GetPublicCategoriesUseCase implements IGetPublicCategories {
    constructor(private readonly categories: ICategoryRepository) {}

    execute(): Promise<Category[]> {
        return this.categories.findAll()
    }
}