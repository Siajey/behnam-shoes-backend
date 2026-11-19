export interface ProductStatsInput {
    productId: string
    unitsSold: number
    favoritesAdded: number
}

export interface ProductStatsRow extends ProductStatsInput {
    isBestSeller: boolean
    isPopular: boolean
}