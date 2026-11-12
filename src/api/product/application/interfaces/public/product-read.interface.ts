import {
    Brand,
    CatalogFilters,
    Category,
    ProductListCriteria,
    ProductPage,
    ProductSearchCriteria,
    ProductWithVariants,
} from '@api/product/domain'

export type PublicProductListQuery = Omit<ProductListCriteria, 'statuses'>
export type PublicProductSearchQuery = Omit<ProductSearchCriteria, 'statuses'>

export interface IListProducts {
    execute(query: PublicProductListQuery): Promise<ProductPage>
}

export interface ISearchProducts {
    execute(query: PublicProductSearchQuery): Promise<ProductPage>
}

export interface IGetProductById {
    execute(id: string): Promise<ProductWithVariants>
}

export interface IGetProductBySlug {
    execute(slug: string): Promise<ProductWithVariants>
}

export interface IGetCatalogFilters {
    execute(query: { categoryId?: string }): Promise<CatalogFilters>
}

export interface IGetPublicCategories {
    execute(): Promise<Category[]>
}

export interface IGetPublicBrands {
    execute(): Promise<Brand[]>
}