import {Module} from '@nestjs/common'

import {DatabaseModule} from '@common/db'
import {
    ATTRIBUTE_DEFINITION_REPOSITORY,
    BRAND_REPOSITORY,
    CATALOG_CACHE,
    CATEGORY_REPOSITORY,
    DEACTIVATE_MISSING_VARIANTS,
    GET_PUBLISHED_PRODUCT_IDS,
    GET_PUBLISHED_PRODUCTS_BY_IDS,
    GET_VARIANTS_BY_IDS,
    PRODUCT_ATTRIBUTE_REPOSITORY,
    PRODUCT_PRICING,
    PRODUCT_QUERY_REPOSITORY,
    PRODUCT_RATING_REPOSITORY,
    PRODUCT_REPOSITORY,
    PRODUCT_STATS_REPOSITORY,
    REPLACE_PRODUCT_STATS,
    UPSERT_PRODUCT_RATING,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {
    AttributeDefinitionRepository,
    BrandRepository,
    CachedProductQueryRepository,
    CatalogCache,
    CategoryRepository,
    DiscountProductPricing,
    ProductAdminUseCaseProviders,
    ProductAttributeRepository,
    ProductAttributeUseCaseProviders,
    ProductQueryRepository,
    ProductRatingRepository,
    ProductReadUseCaseProviders,
    ProductRepository,
    ProductStatsRepository,
    ProductSystemUseCaseProviders,
    ProductVariantAdminUseCaseProviders,
    VariantRepository,
} from './infrastructure'
import {
    AdminAttributeController,
    AdminBrandController,
    AdminCategoryController,
    AdminProductAttributeController,
    AdminProductController,
    AdminVariantController,
    BrandController,
    CategoryController,
    ProductController,
} from './presentation'
import {SessionModule} from "@api/session";
import {FilesModule} from "@common/files";
import {DiscountModule} from "@api/discount/discount.module";
import {CustomCacheModule} from "@common/cache";

@Module({
    imports: [DatabaseModule, SessionModule, FilesModule, DiscountModule, CustomCacheModule],
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
        {provide: CATALOG_CACHE, useClass: CatalogCache},
        {provide: PRODUCT_REPOSITORY, useClass: ProductRepository},
        {
            provide: PRODUCT_QUERY_REPOSITORY,
            inject: [ProductQueryRepository, CatalogCache],
            useFactory: (inner: ProductQueryRepository, cache: CatalogCache) =>
                new CachedProductQueryRepository(inner, cache),
        },
        {provide: VARIANT_REPOSITORY, useClass: VariantRepository},
        {provide: CATEGORY_REPOSITORY, useClass: CategoryRepository},
        {provide: BRAND_REPOSITORY, useClass: BrandRepository},
        {provide: PRODUCT_STATS_REPOSITORY, useClass: ProductStatsRepository},
        {provide: PRODUCT_PRICING, useClass: DiscountProductPricing},
        {provide: ATTRIBUTE_DEFINITION_REPOSITORY, useClass: AttributeDefinitionRepository},
        {provide: PRODUCT_ATTRIBUTE_REPOSITORY, useClass: ProductAttributeRepository},
        {provide: PRODUCT_RATING_REPOSITORY, useClass: ProductRatingRepository},
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
        UPSERT_PRODUCT_RATING
    ],
})
export class ProductModule {
}