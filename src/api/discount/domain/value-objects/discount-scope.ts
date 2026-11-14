export const SCOPE_TYPES = ['all', 'category', 'brand', 'product', 'variant'] as const
export type ScopeType = (typeof SCOPE_TYPES)[number]
export const MAX_SCOPE_TARGETS = 500

export interface DiscountScope {
    type: ScopeType
    targetIds: string[]
}

export interface PricingLine {
    variantId: string
    productId: string
    categoryId: string | null
    brandId: string | null
    unitPrice: number
    quantity: number
}

export function normalizeScope(scope: DiscountScope): DiscountScope {
    return { type: scope.type, targetIds: scope.type === 'all' ? [] : [...new Set(scope.targetIds)] }
}

export function isValidScope(scope: DiscountScope): boolean {
    if (scope.type === 'all') return scope.targetIds.length === 0
    return scope.targetIds.length >= 1 && scope.targetIds.length <= MAX_SCOPE_TARGETS
}

export function scopeMatches(scope: DiscountScope, line: PricingLine): boolean {
    switch (scope.type) {
        case 'all':
            return true
        case 'category':
            return line.categoryId !== null && scope.targetIds.includes(line.categoryId)
        case 'brand':
            return line.brandId !== null && scope.targetIds.includes(line.brandId)
        case 'product':
            return scope.targetIds.includes(line.productId)
        case 'variant':
            return scope.targetIds.includes(line.variantId)
    }
}