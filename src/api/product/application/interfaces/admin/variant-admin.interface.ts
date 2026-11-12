import {
    NewProductData,
    ProductWithVariants,
    UnassignedVariantsCriteria,
    Variant,
} from '@api/product/domain'

export interface AttachVariantsCommand {
    productId: string
    variantIds: string[]
}

export interface MoveVariantsCommand {
    targetProductId: string
    variantIds: string[]
}

export interface MoveVariantsResult {
    target: ProductWithVariants
    unpublishedProductIds: string[]
}

export interface MergeProductsCommand {
    sourceProductId: string
    targetProductId: string
}

export interface SplitProductCommand {
    productId: string
    variantIds: string[]
    newProduct: NewProductData
}

export interface SplitProductResult {
    source: ProductWithVariants
    created: ProductWithVariants
}

export interface IListUnassignedVariants {
    execute(query: UnassignedVariantsCriteria): Promise<{ variants: Variant[]; nextCursor: string | null }>
}
export interface IAttachVariants {
    execute(command: AttachVariantsCommand, actorId: string): Promise<ProductWithVariants>
}
export interface IMoveVariants {
    execute(command: MoveVariantsCommand, actorId: string): Promise<MoveVariantsResult>
}
export interface IMergeProducts {
    execute(command: MergeProductsCommand, actorId: string): Promise<ProductWithVariants>
}
export interface ISplitProduct {
    execute(command: SplitProductCommand, actorId: string): Promise<SplitProductResult>
}