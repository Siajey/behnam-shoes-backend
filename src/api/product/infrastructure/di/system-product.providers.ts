import {
    createProvider,
    DEACTIVATE_MISSING_VARIANTS, GET_PUBLISHED_PRODUCTS_BY_IDS,
    GET_VARIANTS_BY_IDS, PRODUCT_QUERY_REPOSITORY,
    PRODUCT_REPOSITORY,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {
    DeactivateMissingVariantsUseCase, GetPublishedProductsByIdsUseCase,
    GetVariantsByIdsUseCase,
    UpsertVariantsFromExternalUseCase,
} from '@api/product/application'

export const ProductSystemUseCaseProviders = [
    createProvider<UpsertVariantsFromExternalUseCase>(
        UPSERT_VARIANTS_FROM_EXTERNAL, UpsertVariantsFromExternalUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY],
    ),
    createProvider<DeactivateMissingVariantsUseCase>(
        DEACTIVATE_MISSING_VARIANTS, DeactivateMissingVariantsUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY],
    ),
    createProvider<GetVariantsByIdsUseCase>(GET_VARIANTS_BY_IDS, GetVariantsByIdsUseCase, [VARIANT_REPOSITORY]),
    createProvider<GetPublishedProductsByIdsUseCase>(
        GET_PUBLISHED_PRODUCTS_BY_IDS, GetPublishedProductsByIdsUseCase, [PRODUCT_QUERY_REPOSITORY],
    ),
]