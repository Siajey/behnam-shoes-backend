export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const PRODUCT_TYPES = ['shoe'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const ALLOWED_STATUS_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
    draft: ['published', 'archived'],
    published: ['draft', 'archived'],
    archived: ['draft'],
}