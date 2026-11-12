import { Brand, Category } from '@api/product/domain'

export interface CreateCategoryInput {
    name: string
    slug: string
    parentId?: string | null
    sortOrder?: number
}

export interface EditCategoryInput {
    id: string
    name?: string
    slug?: string
    parentId?: string | null
    sortOrder?: number
}

export interface CreateBrandInput {
    name: string
    slug: string
    logoKey?: string | null
}

export interface EditBrandInput {
    id: string
    name?: string
    slug?: string
    logoKey?: string | null
}

export interface ICreateCategory {
    execute(input: CreateCategoryInput, actorId: string): Promise<Category>
}
export interface IEditCategory {
    execute(input: EditCategoryInput, actorId: string): Promise<Category>
}
export interface IDeleteCategory {
    execute(id: string, actorId: string): Promise<void>
}

export interface ICreateBrand {
    execute(input: CreateBrandInput, actorId: string): Promise<Brand>
}
export interface IEditBrand {
    execute(input: EditBrandInput, actorId: string): Promise<Brand>
}
export interface IDeleteBrand {
    execute(id: string, actorId: string): Promise<void>
}