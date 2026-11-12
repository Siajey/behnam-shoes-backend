import {
    NewProductData,
    NewProductImage,
    Product,
    ProductPage,
    ProductSearchCriteria,
    ProductStatus,
    ProductWithVariants,
    ShoeDetails,
} from '@api/product/domain'

export type CreateProductCommand = NewProductData & { variantIds?: string[] }

export interface UpdateProductCommand {
    id: string
    name?: string
    slug?: string
    description?: string
    categoryId?: string | null
    brandId?: string | null
    shoe?: Partial<ShoeDetails>
}

export interface UpdateProductGalleryCommand {
    productId: string
    images: NewProductImage[]
}

export type AdminProductListQuery = Omit<ProductSearchCriteria, 'statuses' | 'q'> & {
    statuses?: ProductStatus[]
    q?: string
}

export interface ICreateProduct {
    execute(command: CreateProductCommand, actorId: string): Promise<ProductWithVariants>
}
export interface IUpdateProduct {
    execute(command: UpdateProductCommand, actorId: string): Promise<ProductWithVariants>
}
export interface IUpdateProductGallery {
    execute(command: UpdateProductGalleryCommand, actorId: string): Promise<Product>
}
export interface IPublishProduct {
    execute(productId: string, actorId: string): Promise<Product>
}
export interface IUnpublishProduct {
    execute(productId: string, actorId: string): Promise<Product>
}
export interface IArchiveProduct {
    execute(productId: string, actorId: string): Promise<Product>
}
export interface IAdminListProducts {
    execute(query: AdminProductListQuery): Promise<ProductPage>
}
export interface IAdminGetProductById {
    execute(id: string): Promise<ProductWithVariants>
}