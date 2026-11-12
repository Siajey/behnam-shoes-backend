import {ListQuery} from "@common/dto";

import { Variant } from '../entities'

export type UnassignedVariantsCriteria = ListQuery<never>

export interface IVariantRepository {
    findById(id: string): Promise<Variant | null>
    findByIds(ids: string[]): Promise<Variant[]>
    findByProductId(productId: string): Promise<Variant[]>
    findByExternal(source: string, externalId: string): Promise<Variant | null>
    findUnassigned(
        criteria: UnassignedVariantsCriteria,
    ): Promise<{ variants: Variant[]; nextCursor: string | null }>
    save(variant: Variant): Promise<void>
    saveMany(variants: Variant[]): Promise<void>
    findByExternalIds(source: string, externalIds: string[]): Promise<Variant[]>
    findActiveBySource(source: string): Promise<Variant[]>
}