import { ExternalVariantSnapshot, Variant } from '@api/product/domain'

export type ExternalVariantInput = ExternalVariantSnapshot & { externalId: string }

export interface UpsertVariantsFromExternalCommand {
    source: string
    items: ExternalVariantInput[]
}

export interface UpsertVariantsResult {
    created: number
    updated: number
    unchanged: number
    rejectedExternalIds: string[]
    unpublishedProductIds: string[]
}

export interface DeactivateMissingVariantsCommand {
    source: string
    presentExternalIds: string[]
}

export interface DeactivateMissingVariantsResult {
    deactivated: number
    unpublishedProductIds: string[]
}

export interface IUpsertVariantsFromExternal {
    execute(command: UpsertVariantsFromExternalCommand): Promise<UpsertVariantsResult>
}
export interface IDeactivateMissingVariants {
    execute(command: DeactivateMissingVariantsCommand): Promise<DeactivateMissingVariantsResult>
}
export interface IGetVariantsByIds {
    execute(ids: string[]): Promise<Variant[]>
}