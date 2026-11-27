import {
    ATTRIBUTE_DEFINITION_REPOSITORY, createProvider,
    PRODUCT_ATTRIBUTE_REPOSITORY, PRODUCT_PRICING, PRODUCT_RATING_REPOSITORY, PRODUCT_STATS_REPOSITORY
} from '@common/di'
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
    SearchProductsUseCase
} from '@api/product/application'

const metaDeps = [PRODUCT_QUERY_REPOSITORY, PRODUCT_PRICING, PRODUCT_STATS_REPOSITORY,PRODUCT_RATING_REPOSITORY]


export const ProductReadUseCaseProviders = [
    createProvider<ListProductsUseCase>(LIST_PRODUCTS, ListProductsUseCase, metaDeps),
    createProvider<SearchProductsUseCase>(SEARCH_PRODUCTS, SearchProductsUseCase, metaDeps),
    createProvider<GetProductByIdUseCase>(GET_PRODUCT_BY_ID, GetProductByIdUseCase, [...metaDeps,
        ATTRIBUTE_DEFINITION_REPOSITORY, PRODUCT_ATTRIBUTE_REPOSITORY,
    ]),
    createProvider<GetProductBySlugUseCase>(GET_PRODUCT_BY_SLUG, GetProductBySlugUseCase, [...metaDeps,
        ATTRIBUTE_DEFINITION_REPOSITORY, PRODUCT_ATTRIBUTE_REPOSITORY,
    ]),
    createProvider<GetCatalogFiltersUseCase>(GET_CATALOG_FILTERS, GetCatalogFiltersUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<GetPublicCategoriesUseCase>(GET_PUBLIC_CATEGORIES, GetPublicCategoriesUseCase, [CATEGORY_REPOSITORY]),
    createProvider<GetPublicBrandsUseCase>(GET_PUBLIC_BRANDS, GetPublicBrandsUseCase, [BRAND_REPOSITORY]),
]