import {Module} from '@nestjs/common'

import {DatabaseModule} from '@common/db'
import {
    ATTRIBUTE_DEFINITION_REPOSITORY,
    BRAND_REPOSITORY,
    CATEGORY_REPOSITORY,
    DEACTIVATE_MISSING_VARIANTS, GET_PUBLISHED_PRODUCT_IDS, GET_PUBLISHED_PRODUCTS_BY_IDS,
    GET_VARIANTS_BY_IDS, PRODUCT_ATTRIBUTE_REPOSITORY, PRODUCT_PRICING,
    PRODUCT_QUERY_REPOSITORY,
    PRODUCT_REPOSITORY, PRODUCT_STATS_REPOSITORY, REPLACE_PRODUCT_STATS,
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
    ProductVariantAdminUseCaseProviders, ProductStatsRepository, DiscountProductPricing, AttributeDefinitionRepository,
    ProductAttributeRepository, ProductAttributeUseCaseProviders,
} from './infrastructure'
import {
    AdminAttributeController,
    AdminBrandController,
    AdminCategoryController, AdminProductAttributeController,
    AdminProductController,
    AdminVariantController,
    BrandController,
    CategoryController,
    ProductController,
} from './presentation'
import {SessionModule} from "@api/session";
import {FilesModule} from "@common/files";
import {DiscountModule} from "@api/discount/discount.module";

@Module({
    imports: [DatabaseModule, SessionModule, FilesModule,DiscountModule],
    controllers: [
        ProductController,
        CategoryController,
        BrandController,
        AdminProductController,
        AdminVariantController,
        AdminCategoryController,
        AdminBrandController,
        AdminAttributeController,
        AdminProductAttributeController,
    ],
    providers: [
        {provide: PRODUCT_REPOSITORY, useClass: ProductRepository},
        {provide: PRODUCT_QUERY_REPOSITORY, useClass: ProductQueryRepository},
        {provide: VARIANT_REPOSITORY, useClass: VariantRepository},
        {provide: CATEGORY_REPOSITORY, useClass: CategoryRepository},
        {provide: BRAND_REPOSITORY, useClass: BrandRepository},
        { provide: PRODUCT_STATS_REPOSITORY, useClass: ProductStatsRepository },
        { provide: PRODUCT_PRICING, useClass: DiscountProductPricing },
        { provide: ATTRIBUTE_DEFINITION_REPOSITORY, useClass: AttributeDefinitionRepository },
        { provide: PRODUCT_ATTRIBUTE_REPOSITORY, useClass: ProductAttributeRepository },
        ...ProductAttributeUseCaseProviders,
        ...ProductReadUseCaseProviders,
        ...ProductAdminUseCaseProviders,
        ...ProductVariantAdminUseCaseProviders,
        ...ProductSystemUseCaseProviders,
    ],
    exports: [UPSERT_VARIANTS_FROM_EXTERNAL,
        DEACTIVATE_MISSING_VARIANTS,
        GET_VARIANTS_BY_IDS,
        GET_PUBLISHED_PRODUCTS_BY_IDS,
        GET_PUBLISHED_PRODUCT_IDS,
        REPLACE_PRODUCT_STATS,
    ],
})
export class ProductModule {
}