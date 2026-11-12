import {
    ATTACH_VARIANTS,
    BRAND_REPOSITORY,
    CATEGORY_REPOSITORY,
    createProvider,
    LIST_UNASSIGNED_VARIANTS,
    MERGE_PRODUCTS,
    MOVE_VARIANTS,
    PRODUCT_REPOSITORY,
    SPLIT_PRODUCT,
    VARIANT_REPOSITORY,
} from '@common/di'
import {
    AttachVariantsUseCase,
    ListUnassignedVariantsUseCase,
    MergeProductsUseCase,
    MoveVariantsUseCase,
    SplitProductUseCase,
} from '@api/product/application'

export const ProductVariantAdminUseCaseProviders = [
    createProvider<ListUnassignedVariantsUseCase>(LIST_UNASSIGNED_VARIANTS, ListUnassignedVariantsUseCase, [VARIANT_REPOSITORY]),
    createProvider<AttachVariantsUseCase>(ATTACH_VARIANTS, AttachVariantsUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY]),
    createProvider<MoveVariantsUseCase>(MOVE_VARIANTS, MoveVariantsUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY]),
    createProvider<MergeProductsUseCase>(MERGE_PRODUCTS, MergeProductsUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY]),
    createProvider<SplitProductUseCase>(SPLIT_PRODUCT, SplitProductUseCase, [
        PRODUCT_REPOSITORY, VARIANT_REPOSITORY, CATEGORY_REPOSITORY, BRAND_REPOSITORY,
    ]),
]