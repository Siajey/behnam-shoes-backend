import { ProductWithVariants } from '@api/product/domain'

export interface IGetPublishedProductsByIds {
    execute(ids: string[]): Promise<ProductWithVariants[]>
}

export interface IGetPublishedProductIds {
    execute(ids: string[]): Promise<string[]>
}