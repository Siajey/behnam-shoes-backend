import {
    CreateProductInput,
    Product,
} from '../entities'
import {
    ShoeGender,
    ShoeProduct
} from '../child-entities'

export type NewProductData = CreateProductInput & {
    type: 'shoe'
    gender: ShoeGender
    material?: string | null
}

export function createProduct(data: NewProductData): Product {
    switch (data.type) {
        case 'shoe':
            return ShoeProduct.create({...data, material: data.material ?? null})
    }
}