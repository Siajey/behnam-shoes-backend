import {
    ProductStatsInput, ProductStatsRow, ProductTag, ProductTagFlags,
} from '../value-objects'

export interface TagRules {
    newestWindowDays: number
    statsWindowDays: number
    bestSellerCount: number
    minUnitsSold: number
    popularCount: number
    minFavorites: number
}

export const DEFAULT_TAG_RULES: TagRules = {
    newestWindowDays: 14,
    statsWindowDays: 30,
    bestSellerCount: 10,
    minUnitsSold: 3,
    popularCount: 10,
    minFavorites: 3,
}

const DAY_MS = 24 * 60 * 60 * 1000

export function tagsFor(
    publishedAt: Date | null,
    flags: ProductTagFlags | null,
    now: Date,
    rules: TagRules = DEFAULT_TAG_RULES,
): ProductTag[] {
    const tags: ProductTag[] = []
    if (publishedAt && now.getTime() - publishedAt.getTime() < rules.newestWindowDays * DAY_MS) {
        tags.push('newest')
    }
    if (flags?.isBestSeller) tags.push('best_seller')
    if (flags?.isPopular) tags.push('popular')
    return tags
}

function topProducts(
    items: readonly ProductStatsInput[],
    metric: (item: ProductStatsInput) => number,
    minimum: number,
    count: number,
): Set<string> {
    return new Set(
        items
            .filter((i) => metric(i) >= minimum)

            .sort((a, b) => metric(b) - metric(a) || a.productId.localeCompare(b.productId))
            .slice(0, count)
            .map((i) => i.productId),
    )
}
export function rankProductStats(
    items: readonly ProductStatsInput[],
    rules: TagRules = DEFAULT_TAG_RULES,
): ProductStatsRow[] {
    const best = topProducts(items, (i) => i.unitsSold, rules.minUnitsSold, rules.bestSellerCount)
    const popular = topProducts(items, (i) => i.favoritesAdded, rules.minFavorites, rules.popularCount)

    return items.map((i) => ({
        ...i,
        isBestSeller: best.has(i.productId),
        isPopular: popular.has(i.productId),
    }))
}