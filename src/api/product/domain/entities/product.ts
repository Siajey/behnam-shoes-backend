import {randomUUID} from 'node:crypto'

import {
    ALLOWED_STATUS_TRANSITIONS, AttributeRule,
    ProductStatus,
    ProductType,
} from '../value-objects'
import {
    InvalidProductStatusTransitionError, ProductArchivedError,
    ProductNotPublishableError,
    ProductSlugLockedError,
    TooManyProductImagesError, VariantAttributesInvalidError,
} from '../errors'
import {Variant} from './variant'

export const MAX_PRODUCT_IMAGES = 12

export interface ProductImage {
    id: string
    fileKey: string
    altText: string | null
    position: number
}

export interface NewProductImage {
    fileKey: string
    altText?: string | null
}

export interface ProductProps {
    id: string
    name: string
    slug: string
    description: string
    status: ProductStatus
    categoryId: string | null
    brandId: string | null
    images: ProductImage[]
    publishedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface CreateProductInput {
    name: string
    slug: string
    description: string
    categoryId?: string | null
    brandId?: string | null
}

export abstract class Product {
    abstract readonly type: ProductType
    abstract readonly attributeRules: readonly AttributeRule[]

    protected constructor(protected props: ProductProps) {
    }

    protected static buildProps(input: CreateProductInput): ProductProps {
        const now = new Date()
        return {
            id: randomUUID(),
            name: input.name,
            slug: input.slug,
            description: input.description,
            status: 'draft',
            categoryId: input.categoryId ?? null,
            brandId: input.brandId ?? null,
            images: [],
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
        }
    }

    get id() {
        return this.props.id
    }

    get name() {
        return this.props.name
    }

    get slug() {
        return this.props.slug
    }

    get description() {
        return this.props.description
    }

    get status() {
        return this.props.status
    }

    get categoryId() {
        return this.props.categoryId
    }

    get brandId() {
        return this.props.brandId
    }

    get images(): readonly ProductImage[] {
        return this.props.images
    }

    get publishedAt() {
        return this.props.publishedAt
    }

    get createdAt() {
        return this.props.createdAt
    }

    get updatedAt() {
        return this.props.updatedAt
    }

    get primaryImage(): ProductImage | null {
        return this.props.images[0] ?? null
    }

    updateDetails(input: {
        name?: string
        description?: string
        categoryId?: string | null
        brandId?: string | null
    }): void {
        if (input.categoryId === null && this.props.status === 'published') {
            throw new ProductNotPublishableError(['category'])
        }
        if (input.name !== undefined) this.props.name = input.name
        if (input.description !== undefined) this.props.description = input.description
        if (input.categoryId !== undefined) this.props.categoryId = input.categoryId
        if (input.brandId !== undefined) this.props.brandId = input.brandId
        this.touch()
    }

    changeSlug(slug: string): void {
        if (this.props.publishedAt !== null) throw new ProductSlugLockedError()
        this.props.slug = slug
        this.touch()
    }

    replaceGallery(images: NewProductImage[]): void {
        if (images.length > MAX_PRODUCT_IMAGES) {
            throw new TooManyProductImagesError(MAX_PRODUCT_IMAGES)
        }
        this.props.images = images.map((img, position) => ({
            id: randomUUID(),
            fileKey: img.fileKey,
            altText: img.altText ?? null,
            position,
        }))
        this.touch()
    }

    publish(variants: readonly Variant[]): void {
        this.assertTransition('published')
        this.assertAcceptsVariants(variants.filter((v) => v.isActive))

        const missing: string[] = []
        if (!this.props.categoryId) missing.push('category')
        if (this.props.images.length === 0) missing.push('image')
        if (!variants.some((v) => v.isActive)) missing.push('activeVariant')
        if (missing.length > 0) throw new ProductNotPublishableError(missing)

        this.props.status = 'published'
        this.props.publishedAt ??= new Date()
        this.touch()
    }

    unpublish(): void {
        this.assertTransition('draft')
        this.props.status = 'draft'
        this.touch()
    }

    archive(): void {
        this.assertTransition('archived')
        this.props.status = 'archived'
        this.touch()
    }

    private assertTransition(to: ProductStatus): void {
        if (!ALLOWED_STATUS_TRANSITIONS[this.props.status].includes(to)) {
            throw new InvalidProductStatusTransitionError(this.props.status, to)
        }
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }

    assertAcceptsVariants(variants: readonly Variant[]): void {
        if (this.props.status === 'archived') throw new ProductArchivedError()
        const problems = variants
            .map((v) => {
                const missing: string[] = []
                const invalid: string[] = []
                for (const rule of this.attributeRules) {
                    const value = v.attribute(rule.name)
                    if (value === undefined) {
                        if (rule.required) missing.push(rule.name)
                    } else if (rule.validate && !rule.validate(value)) {
                        invalid.push(rule.name)
                    }
                }
                return {variantId: v.id, missing, invalid}
            })
            .filter((p) => p.missing.length || p.invalid.length)

        if (problems.length) throw new VariantAttributesInvalidError(problems)
    }
}