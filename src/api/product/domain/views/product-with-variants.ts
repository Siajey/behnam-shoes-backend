import { Product,Variant } from '../entities'

export interface ProductOption {
    name: string
    values: string[]
}

export class ProductWithVariants {
    constructor(
        readonly product: Product,
        readonly variants: readonly Variant[],
    ) {}

    get activeVariants(): Variant[] {
        return this.variants.filter((v) => v.isActive)
    }

    get minPrice(): number | null {
        const prices = this.activeVariants.map((v) => v.price)
        return prices.length ? Math.min(...prices) : null
    }

    get maxPrice(): number | null {
        const prices = this.activeVariants.map((v) => v.price)
        return prices.length ? Math.max(...prices) : null
    }

    get isInStock(): boolean {
        return this.activeVariants.some((v) => v.isAvailable)
    }

    get options(): ProductOption[] {
        const map = new Map<string, Set<string>>()
        for (const v of this.activeVariants) {
            for (const a of v.attributes) {
                if (!map.has(a.name)) map.set(a.name, new Set())
                map.get(a.name)!.add(a.value)
            }
        }
        return [...map].map(([name, values]) => ({ name, values: [...values] }))
    }
}