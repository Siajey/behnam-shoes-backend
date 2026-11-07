import {
    BrandNotFoundError,
    CategoryNotFoundError,
    IBrandRepository,
    ICategoryRepository,
} from '@api/product/domain'

export async function assertReferencesExist(
    categories: ICategoryRepository,
    brands: IBrandRepository,
    refs: { categoryId?: string | null; brandId?: string | null },
): Promise<void> {
    if (refs.categoryId && !(await categories.findById(refs.categoryId))) {
        throw new CategoryNotFoundError({ id: refs.categoryId })
    }
    if (refs.brandId && !(await brands.findById(refs.brandId))) {
        throw new BrandNotFoundError({ id: refs.brandId })
    }
}