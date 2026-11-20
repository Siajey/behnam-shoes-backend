import { Brand, Category } from '@api/product/domain'
import {UploadTarget} from "@common/storage";

import { TaxonomyImagePurpose } from "../../constants";

export interface CreateCategoryInput {
    name: string
    slug: string
    parentId?: string | null
    sortOrder?: number
    imageKey?: string | null
}

export interface EditCategoryInput {
    id: string
    name?: string
    slug?: string
    parentId?: string | null
    sortOrder?: number
    imageKey?: string | null
}

export interface CreateBrandInput {
    name: string
    slug: string
    logoKey?: string | null
    imageKey?: string | null
}

export interface EditBrandInput {
    id: string
    name?: string
    slug?: string
    logoKey?: string | null
    imageKey?: string | null
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

export interface CreateTaxonomyImageUploadCommand {
    purpose: TaxonomyImagePurpose
    contentType: string
    sizeBytes: number
}

export interface ICreateTaxonomyImageUpload {
    execute(command: CreateTaxonomyImageUploadCommand): Promise<UploadTarget>
}