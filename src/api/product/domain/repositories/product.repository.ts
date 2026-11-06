import { Product } from '../entities'

export interface IProductRepository {
    findById(id: string): Promise<Product | null>
    findBySlug(slug: string): Promise<Product | null>
    slugExists(slug: string, excludeId?: string): Promise<boolean>
    save(product: Product): Promise<void>
}