import {
    ADMIN_GET_PRODUCT_BY_ID,
    ADMIN_LIST_PRODUCTS,
    ARCHIVE_PRODUCT,
    BRAND_REPOSITORY,
    CATEGORY_REPOSITORY,
    CREATE_BRAND,
    CREATE_CATEGORY, CREATE_PRODUCT,
    createProvider,
    DELETE_BRAND,
    DELETE_CATEGORY,
    EDIT_BRAND,
    EDIT_CATEGORY,
    PRODUCT_QUERY_REPOSITORY,
    PRODUCT_REPOSITORY,
    PUBLISH_PRODUCT,
    UNPUBLISH_PRODUCT,
    UPDATE_PRODUCT,
    UPDATE_PRODUCT_GALLERY,
    VARIANT_REPOSITORY,
} from '@common/di'
import {
    CreateBrandUseCase,
    CreateCategoryUseCase,
    DeleteBrandUseCase,
    DeleteCategoryUseCase,
    EditBrandUseCase,
    EditCategoryUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    UpdateProductGalleryUseCase,
    PublishProductUseCase,
    UnpublishProductUseCase,
    ArchiveProductUseCase,
    AdminListProductsUseCase,
    AdminGetProductByIdUseCase
} from '@api/product/application'

export const ProductAdminUseCaseProviders = [
    createProvider<CreateCategoryUseCase>(CREATE_CATEGORY, CreateCategoryUseCase, [CATEGORY_REPOSITORY]),
    createProvider<EditCategoryUseCase>(EDIT_CATEGORY, EditCategoryUseCase, [CATEGORY_REPOSITORY]),
    createProvider<DeleteCategoryUseCase>(DELETE_CATEGORY, DeleteCategoryUseCase, [CATEGORY_REPOSITORY]),
    createProvider<CreateBrandUseCase>(CREATE_BRAND, CreateBrandUseCase, [BRAND_REPOSITORY]),
    createProvider<EditBrandUseCase>(EDIT_BRAND, EditBrandUseCase, [BRAND_REPOSITORY]),
    createProvider<DeleteBrandUseCase>(DELETE_BRAND, DeleteBrandUseCase, [BRAND_REPOSITORY]),

    createProvider<CreateProductUseCase>(CREATE_PRODUCT, CreateProductUseCase, [
        PRODUCT_REPOSITORY, VARIANT_REPOSITORY, CATEGORY_REPOSITORY, BRAND_REPOSITORY,
    ]),
    createProvider<UpdateProductUseCase>(UPDATE_PRODUCT, UpdateProductUseCase, [
        PRODUCT_REPOSITORY, VARIANT_REPOSITORY, CATEGORY_REPOSITORY, BRAND_REPOSITORY,
    ]),
    createProvider<UpdateProductGalleryUseCase>(UPDATE_PRODUCT_GALLERY, UpdateProductGalleryUseCase, [PRODUCT_REPOSITORY]),
    createProvider<PublishProductUseCase>(PUBLISH_PRODUCT, PublishProductUseCase, [PRODUCT_REPOSITORY, VARIANT_REPOSITORY]),
    createProvider<UnpublishProductUseCase>(UNPUBLISH_PRODUCT, UnpublishProductUseCase, [PRODUCT_REPOSITORY]),
    createProvider<ArchiveProductUseCase>(ARCHIVE_PRODUCT, ArchiveProductUseCase, [PRODUCT_REPOSITORY]),
    createProvider<AdminListProductsUseCase>(ADMIN_LIST_PRODUCTS, AdminListProductsUseCase, [PRODUCT_QUERY_REPOSITORY]),
    createProvider<AdminGetProductByIdUseCase>(ADMIN_GET_PRODUCT_BY_ID, AdminGetProductByIdUseCase, [PRODUCT_QUERY_REPOSITORY]),

]