import { createProvider } from '@common/di'
import {
    BRAND_REPOSITORY,
    CATEGORY_REPOSITORY,
    GET_CATALOG_FILTERS,
    GET_PRODUCT_BY_ID,
    GET_PRODUCT_BY_SLUG,
    GET_PUBLIC_BRANDS,
    GET_PUBLIC_CATEGORIES,
    LIST_PRODUCTS,
    PRODUCT_QUERY_REPOSITORY,
    SEARCH_PRODUCTS,
} from '@common/di'
import {
GetCatalogFiltersUseCase,
GetProductByIdUseCase,
GetProductBySlugUseCase,
GetPublicBrandsUseCase,
GetPublicCategoriesUseCase,
ListProductsUseCase,
SearchProductsUseCase} from '@api/product/application'

export const ProductReadUseCaseProviders = [
    createProvider<ListProductsUseCase>(LIST_PRODUCTS, ListProductsUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<SearchProductsUseCase>(SEARCH_PRODUCTS, SearchProductsUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<GetProductByIdUseCase>(GET_PRODUCT_BY_ID, GetProductByIdUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<GetProductBySlugUseCase>(GET_PRODUCT_BY_SLUG, GetProductBySlugUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<GetCatalogFiltersUseCase>(GET_CATALOG_FILTERS, GetCatalogFiltersUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<GetPublicCategoriesUseCase>(GET_PUBLIC_CATEGORIES, GetPublicCategoriesUseCase, [CATEGORY_REPOSITORY]),
    createProvider<GetPublicBrandsUseCase>(GET_PUBLIC_BRANDS, GetPublicBrandsUseCase, [BRAND_REPOSITORY]),
]