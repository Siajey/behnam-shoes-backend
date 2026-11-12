import {eq} from 'drizzle-orm'

import {Database} from '@common/db'
import {Product, Variant} from '@api/product/domain'

import {ProductMapper, VariantMapper} from '../mappers'
import * as schema from '../models'

export type Tx = Parameters<Parameters<Database<typeof schema>['transaction']>[0]>[0]

export async function persistProduct(tx: Tx, product: Product): Promise<void> {
    const {product: row, images, shoe} = ProductMapper.toPersistence(product)
    const {id, ...rest} = row

    await tx
        .insert(schema.products)
        .values(row)
        .onConflictDoUpdate({target: schema.products.id, set: rest})

    await tx.delete(schema.productImages).where(eq(schema.productImages.productId, id as string))
    if (images.length) await tx.insert(schema.productImages).values(images)

    if (shoe) {
        await tx
            .insert(schema.shoeProductDetails)
            .values(shoe)
            .onConflictDoUpdate({
                target: schema.shoeProductDetails.productId,
                set: {gender: shoe.gender, material: shoe.material},
            })
    }
}

export async function persistVariant(tx: Tx, variant: Variant): Promise<void> {
    const {variant: row, attributes} = VariantMapper.toPersistence(variant)
    const {id, ...rest} = row

    await tx
        .insert(schema.variants)
        .values(row)
        .onConflictDoUpdate({target: schema.variants.id, set: rest})

    await tx.delete(schema.variantAttributes).where(eq(schema.variantAttributes.variantId, id as string))
    if (attributes.length) await tx.insert(schema.variantAttributes).values(attributes)
}