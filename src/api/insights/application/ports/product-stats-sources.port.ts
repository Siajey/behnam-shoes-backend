export interface ProductSalesRow {
    productId: string;
    unitsSold: number
}

export interface IProductSalesSource {
    unitsSoldSince(since: Date): Promise<ProductSalesRow[]>
}

export interface ProductFavoritesRow {
    productId: string;
    favoritesAdded: number
}

export interface IProductFavoritesSource {
    favoritesAddedSince(since: Date): Promise<ProductFavoritesRow[]>
}

export interface ProductStatsItem {
    productId: string;
    unitsSold: number;
    favoritesAdded: number
}

export interface ProductStatsOutcome {
    total: number;
    bestSellers: number;
    popular: number
}

export interface IProductStatsSink {
    replace(items: ProductStatsItem[]): Promise<ProductStatsOutcome>
}
