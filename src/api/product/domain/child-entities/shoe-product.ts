import { CreateProductInput, Product, ProductProps } from '../entities'
import { AttributeRule } from "../value-objects"

export const SHOE_GENDERS = ['men', 'women', 'unisex', 'kids'] as const
export type ShoeGender = (typeof SHOE_GENDERS)[number]

export interface ShoeDetails {
    gender: ShoeGender
    material: string | null
}
const isValidShoeSize = (value: string): boolean => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 16 && n <= 50 && Number.isInteger(n * 2)
}

export class ShoeProduct extends Product {
    readonly type = 'shoe' as const
    readonly attributeRules: readonly AttributeRule[] = [
        { name: 'size', required: true, validate: isValidShoeSize },
        { name: 'color', required: true },
    ]

    private constructor(props: ProductProps, private details: ShoeDetails) {
        super(props)
    }

    static create(input: CreateProductInput & ShoeDetails): ShoeProduct {
        return new ShoeProduct(Product.buildProps(input), {
            gender: input.gender,
            material: input.material ?? null,
        })
    }

    static restore(props: ProductProps, details: ShoeDetails): ShoeProduct {
        return new ShoeProduct(props, details)
    }

    get gender() { return this.details.gender }
    get material() { return this.details.material }

    updateShoeDetails(input: Partial<ShoeDetails>): void {
        this.details = { ...this.details, ...input }
        this.props.updatedAt = new Date()
    }
}