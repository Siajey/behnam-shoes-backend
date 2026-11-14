import {Module} from '@nestjs/common'

import {DatabaseModule} from '@common/db'
import {
    BRAND_REPOSITORY,
    CATEGORY_REPOSITORY,
    DEACTIVATE_MISSING_VARIANTS, GET_PUBLISHED_PRODUCT_IDS, GET_PUBLISHED_PRODUCTS_BY_IDS,
    GET_VARIANTS_BY_IDS,
    PRODUCT_QUERY_REPOSITORY,
    PRODUCT_REPOSITORY,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {
    BrandRepository,
    CategoryRepository,
    ProductQueryRepository,
    ProductRepository,
    VariantRepository,
    ProductAdminUseCaseProviders,
    ProductReadUseCaseProviders,
    ProductSystemUseCaseProviders,
    ProductVariantAdminUseCaseProviders,
} from './infrastructure'
import {
    AdminBrandController,
    AdminCategoryController,
    AdminProductController,
    AdminVariantController,
    BrandController,
    CategoryController,
    ProductController,
} from './presentation'
import {SessionModule} from "@api/session";

@Module({
    imports: [DatabaseModule, SessionModule],
    controllers: [
        ProductController,
        CategoryController,
        BrandController,
        AdminProductController,
        AdminVariantController,
        AdminCategoryController,
        AdminBrandController,
    ],
    providers: [
        {provide: PRODUCT_REPOSITORY, useClass: ProductRepository},
        {provide: PRODUCT_QUERY_REPOSITORY, useClass: ProductQueryRepository},
        {provide: VARIANT_REPOSITORY, useClass: VariantRepository},
        {provide: CATEGORY_REPOSITORY, useClass: CategoryRepository},
        {provide: BRAND_REPOSITORY, useClass: BrandRepository},
        ...ProductReadUseCaseProviders,
        ...ProductAdminUseCaseProviders,
        ...ProductVariantAdminUseCaseProviders,
        ...ProductSystemUseCaseProviders,
    ],
    exports: [UPSERT_VARIANTS_FROM_EXTERNAL,
        DEACTIVATE_MISSING_VARIANTS,
        GET_VARIANTS_BY_IDS,
        GET_PUBLISHED_PRODUCTS_BY_IDS,
        GET_PUBLISHED_PRODUCT_IDS
    ],
})
export class ProductModule {
}