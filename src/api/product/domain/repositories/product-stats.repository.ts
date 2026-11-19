import { ProductStatsRow, ProductTagFlags } from '../value-objects'

export interface IProductStatsRepository {
    replaceAll(rows: readonly ProductStatsRow[]): Promise<void>
    findFlagsByProductIds(productIds: string[]): Promise<Map<string, ProductTagFlags>>
}