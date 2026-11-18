import {
    Brand,
    CatalogFilters,
    Category,
    ProductListCriteria,
    ProductSearchCriteria,
} from '@api/product/domain'
import { ProductWithMeta } from '@api/product/domain'

export type PublicProductListQuery = Omit<ProductListCriteria, 'statuses'>
export type PublicProductSearchQuery = Omit<ProductSearchCriteria, 'statuses'>


export interface ProductMetaPage {
    products: ProductWithMeta[]
    nextCursor: string | null
}

export interface IListProducts {
    execute(query: PublicProductListQuery): Promise<ProductMetaPage>
}
export interface ISearchProducts {
    execute(query: PublicProductSearchQuery): Promise<ProductMetaPage>
}
export interface IGetProductById {
    execute(id: string): Promise<ProductWithMeta>
}
export interface IGetProductBySlug {
    execute(slug: string): Promise<ProductWithMeta>
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