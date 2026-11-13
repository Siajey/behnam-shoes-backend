import { FavoriteProductSummary } from '@api/favorites/domain'

export interface IFavoriteProductCatalog {
    findPublishedIds(productIds: string[]): Promise<string[]>
    findSummaries(productIds: string[]): Promise<FavoriteProductSummary[]>
}