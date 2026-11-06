import {
    ConflictError,
    NotFoundError,
    ValidationError,
} from '@common/errors'

export class ProductNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.product.notFound', code: 'PRODUCT_NOT_FOUND', details })
    }
}
export class ProductSlugAlreadyExistsError extends ConflictError {
    constructor(slug: string) {
        super({
            message: 'errors.product.slugAlreadyExists',
            code: 'PRODUCT_SLUG_ALREADY_EXISTS',
            details: { slug },
        })
    }
}
export class ProductSlugLockedError extends ConflictError {
    constructor() {
        super({ message: 'errors.product.slugLocked', code: 'PRODUCT_SLUG_LOCKED' })
    }
}
export class ProductNotPublishableError extends ValidationError {
    constructor(missing: string[]) {
        super({
            message: 'errors.product.notPublishable',
            code: 'PRODUCT_NOT_PUBLISHABLE',
            details: { missing },
        })
    }
}
export class InvalidProductStatusTransitionError extends ConflictError {
    constructor(from: string, to: string) {
        super({
            message: 'errors.product.invalidStatusTransition',
            code: 'PRODUCT_INVALID_STATUS_TRANSITION',
            details: { from, to },
        })
    }
}
export class TooManyProductImagesError extends ValidationError {
    constructor(max: number) {
        super({
            message: 'errors.product.tooManyImages',
            code: 'PRODUCT_TOO_MANY_IMAGES',
            details: { max },
        })
    }
}

export class VariantNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.variant.notFound', code: 'VARIANT_NOT_FOUND', details })
    }
}
export class InvalidVariantPriceError extends ValidationError {
    constructor() {
        super({ message: 'errors.variant.invalidPrice', code: 'VARIANT_INVALID_PRICE' })
    }
}
export class InvalidVariantStockError extends ValidationError {
    constructor() {
        super({ message: 'errors.variant.invalidStock', code: 'VARIANT_INVALID_STOCK' })
    }
}

export class CategoryNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.category.notFound', code: 'CATEGORY_NOT_FOUND', details })
    }
}
export class CategorySlugAlreadyExistsError extends ConflictError {
    constructor(slug: string) {
        super({
            message: 'errors.category.slugAlreadyExists',
            code: 'CATEGORY_SLUG_ALREADY_EXISTS',
            details: { slug },
        })
    }
}
export class CategoryCircularParentError extends ValidationError {
    constructor() {
        super({ message: 'errors.category.circularParent', code: 'CATEGORY_CIRCULAR_PARENT' })
    }
}
export class CategoryHasChildrenError extends ConflictError {
    constructor() {
        super({ message: 'errors.category.hasChildren', code: 'CATEGORY_HAS_CHILDREN' })
    }
}
export class CategoryHasProductsError extends ConflictError {
    constructor() {
        super({ message: 'errors.category.hasProducts', code: 'CATEGORY_HAS_PRODUCTS' })
    }
}

export class BrandNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.brand.notFound', code: 'BRAND_NOT_FOUND', details })
    }
}
export class BrandSlugAlreadyExistsError extends ConflictError {
    constructor(slug: string) {
        super({
            message: 'errors.brand.slugAlreadyExists',
            code: 'BRAND_SLUG_ALREADY_EXISTS',
            details: { slug },
        })
    }
}
export class BrandHasProductsError extends ConflictError {
    constructor() {
        super({ message: 'errors.brand.hasProducts', code: 'BRAND_HAS_PRODUCTS' })
    }
}

export class VariantAttributesInvalidError extends ValidationError {
    constructor(problems: { missing: string[]; invalid: string[]; variantId: string }[]) {
        super({
            message: 'errors.variant.invalidAttributes',
            code: 'VARIANT_INVALID_ATTRIBUTES',
            details: { problems },
        })
    }
}