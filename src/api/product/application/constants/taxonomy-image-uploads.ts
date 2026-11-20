import { UploadPolicy } from '@common/storage'

const MB = 1024 * 1024

export const CATEGORY_IMAGE_UPLOAD_POLICY: UploadPolicy = {
    folder: 'categories',
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * MB,
}

export const BRAND_COVER_UPLOAD_POLICY: UploadPolicy = {
    folder: 'brands/covers',
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * MB,
}

export const BRAND_LOGO_UPLOAD_POLICY: UploadPolicy = {
    folder: 'brands/logos',
    allowedContentTypes: ['image/png', 'image/webp'],
    maxSizeBytes: MB,
}

export const TAXONOMY_IMAGE_PURPOSES = ['category', 'brand_cover', 'brand_logo'] as const
export type TaxonomyImagePurpose = (typeof TAXONOMY_IMAGE_PURPOSES)[number]

export const TAXONOMY_IMAGE_POLICIES: Record<TaxonomyImagePurpose, UploadPolicy> = {
    category: CATEGORY_IMAGE_UPLOAD_POLICY,
    brand_cover: BRAND_COVER_UPLOAD_POLICY,
    brand_logo: BRAND_LOGO_UPLOAD_POLICY,
}