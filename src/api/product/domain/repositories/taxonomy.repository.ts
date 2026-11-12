import { Brand,Category } from '../entities'

export interface ICategoryRepository {
    findById(id: string): Promise<Category | null>
    findBySlug(slug: string): Promise<Category | null>
    findAll(): Promise<Category[]>
    hasChildren(id: string): Promise<boolean>
    hasProducts(id: string): Promise<boolean>
    save(category: Category): Promise<void>
    delete(id: string): Promise<void>
}

export interface IBrandRepository {
    findById(id: string): Promise<Brand | null>
    findBySlug(slug: string): Promise<Brand | null>
    findAll(): Promise<Brand[]>
    hasProducts(id: string): Promise<boolean>
    save(brand: Brand): Promise<void>
    delete(id: string): Promise<void>
}