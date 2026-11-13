export interface FavoriteProductSummary {
    id: string
    name: string
    slug: string
    imageKey: string | null
    minPrice: number | null
    maxPrice: number | null
    inStock: boolean
}