import { ProductWithVariants } from '@api/product/domain'

export interface IGetPublishedProductsByIds {
    execute(ids: string[]): Promise<ProductWithVariants[]>
}