import { ProductStatsInput } from '@api/product/domain'

export interface ReplaceProductStatsCommand {
    items: ProductStatsInput[]
}

export interface ReplaceProductStatsResult {
    total: number
    bestSellers: number
    popular: number
}

export interface IReplaceProductStats {
    execute(command: ReplaceProductStatsCommand): Promise<ReplaceProductStatsResult>
}