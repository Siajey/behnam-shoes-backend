import {
    createProvider,
    DEACTIVATE_MISSING_VARIANTS,
    GET_VARIANTS_BY_IDS,
    PRODUCT_REPOSITORY,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {
    DeactivateMissingVariantsUseCase,
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
]