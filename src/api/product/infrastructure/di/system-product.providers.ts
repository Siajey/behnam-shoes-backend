import {
    createProvider,
    DEACTIVATE_MISSING_VARIANTS,
    GET_PUBLISHED_PRODUCT_IDS,
    GET_PUBLISHED_PRODUCTS_BY_IDS,
    GET_VARIANTS_BY_IDS,
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
    DeactivateMissingVariantsUseCase,
    GetPublishedProductIdsUseCase,
    GetPublishedProductsByIdsUseCase,
    GetVariantsByIdsUseCase,
    ReplaceProductStatsUseCase,
    UpsertVariantsFromExternalUseCase,
} from '@api/product/application'
import UpsertProductRatingUseCase from "../../application/usecase/system/upsert-product-rating.usecase";

export const ProductSystemUseCaseProviders = [
    createProvider<UpsertVariantsFromExternalUseCase>(
        UPSERT_VARIANTS_FROM_EXTERNAL,
        UpsertVariantsFromExternalUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY],
    ),
    createProvider<DeactivateMissingVariantsUseCase>(
        DEACTIVATE_MISSING_VARIANTS, DeactivateMissingVariantsUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY],
    ),
    createProvider<GetVariantsByIdsUseCase>(GET_VARIANTS_BY_IDS, GetVariantsByIdsUseCase, [VARIANT_REPOSITORY]),
    createProvider<GetPublishedProductsByIdsUseCase>(
        GET_PUBLISHED_PRODUCTS_BY_IDS, GetPublishedProductsByIdsUseCase, [PRODUCT_QUERY_REPOSITORY],
    ),
    createProvider<GetPublishedProductIdsUseCase>(
        GET_PUBLISHED_PRODUCT_IDS, GetPublishedProductIdsUseCase, [PRODUCT_QUERY_REPOSITORY],
    ),
    createProvider<ReplaceProductStatsUseCase>(
        REPLACE_PRODUCT_STATS, ReplaceProductStatsUseCase, [PRODUCT_STATS_REPOSITORY],
    ),
    createProvider<UpsertProductRatingUseCase>(
        UPSERT_PRODUCT_RATING, UpsertProductRatingUseCase, [PRODUCT_RATING_REPOSITORY],
    ),
]