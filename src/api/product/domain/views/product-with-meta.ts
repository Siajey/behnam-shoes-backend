import {ProductMeta, ResolvedAttribute} from '../value-objects'
import { ProductWithVariants } from './product-with-variants'

export interface ProductWithMeta {
    view: ProductWithVariants
    meta: ProductMeta
    attributes: ResolvedAttribute[]
}