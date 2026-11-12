import {Controller, Get, Inject, Param, Query} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {
    IGetCatalogFilters,
    IGetProductById,
    IGetProductBySlug,
    IListProducts,
    ISearchProducts,
} from '@api/product/application'
import {
    GET_CATALOG_FILTERS,
    GET_PRODUCT_BY_ID,
    GET_PRODUCT_BY_SLUG,
    LIST_PRODUCTS,
    SEARCH_PRODUCTS,
} from '@common/di'
import {slugSchema, uuidSchema, ZodValidationPipe} from '@common/validations'
import {PUBLIC_READ_THROTTLE} from '@common/security'
import {SuccessResponse} from "@common/api";

import {
    CatalogFiltersQuery,
    CatalogFiltersQuerySchema,
    ListProductsQuery,
    ListProductsQuerySchema,
    SearchProductsQuery,
    SearchProductsQuerySchema,
} from '../../dtos'

import {toProductListQuery, toProductSearchQuery} from '../../mappers'
import {ProductPresenter} from '../../presenters'

@Controller('products')
@Throttle(PUBLIC_READ_THROTTLE)
export default class ProductController {
    constructor(
        @Inject(LIST_PRODUCTS) private readonly listProducts: IListProducts,
        @Inject(SEARCH_PRODUCTS) private readonly searchProducts: ISearchProducts,
        @Inject(GET_CATALOG_FILTERS) private readonly getFilters: IGetCatalogFilters,
        @Inject(GET_PRODUCT_BY_ID) private readonly getById: IGetProductById,
        @Inject(GET_PRODUCT_BY_SLUG) private readonly getBySlug: IGetProductBySlug,
    ) {
    }

    @Get()
    async listController(
        @Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQuery,
    ) {
        const page = await this.listProducts.execute(toProductListQuery(query))
        return new SuccessResponse({
            messageObj: {message: 'common.product.listSuccess'},
            code: 'PRODUCT_LIST_SUCCESS',
            path: '/products',
            data: {
                items: page.products.map((v) => ProductPresenter.publicListItem(v)),
                nextCursor: page.nextCursor,
            },
        })
    }

    @Get('search')
    async searchController(
        @Query(new ZodValidationPipe(SearchProductsQuerySchema)) query: SearchProductsQuery,
    ) {
        const page = await this.searchProducts.execute(toProductSearchQuery(query))
        return new SuccessResponse({
            messageObj: {message: 'common.product.searchSuccess'},
            code: 'PRODUCT_SEARCH_SUCCESS',
            path: '/products/search',
            data: {
                items: page.products.map((v) => ProductPresenter.publicListItem(v)),
                nextCursor: page.nextCursor,
            },
        })
    }

    @Get('filters')
    async filtersController(
        @Query(new ZodValidationPipe(CatalogFiltersQuerySchema)) query: CatalogFiltersQuery,
    ) {
        return new SuccessResponse({
            messageObj: {message: 'common.product.filtersSuccess'},
            code: 'PRODUCT_FILTERS_SUCCESS',
            path: '/products/filters',
            data: await this.getFilters.execute(query),
        })
    }

    @Get('slug/:slug')
    async getBySlugController(@Param('slug', new ZodValidationPipe(slugSchema(220))) slug: string) {
        const view = await this.getBySlug.execute(slug)
        return new SuccessResponse({
            messageObj: {message: 'common.product.getSuccess'},
            code: 'PRODUCT_GET_SUCCESS',
            path: `/products/slug/${slug}`,
            data: ProductPresenter.publicDetail(view),
        })
    }

    @Get(':id')
    async getByIdController(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
        const view = await this.getById.execute(id)
        return new SuccessResponse({
            messageObj: {message: 'common.product.getSuccess'},
            code: 'PRODUCT_GET_SUCCESS',
            path: `/products/${id}`,
            data: ProductPresenter.publicDetail(view),
        })
    }
}