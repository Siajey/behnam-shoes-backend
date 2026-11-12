import {
    IProductRepository,
    IVariantRepository,
    Variant,
} from '@api/product/domain'
import {AppError} from "@common/errors";

import { collectProductsToUnpublish } from '../../helpers'
import {
    IUpsertVariantsFromExternal,
    UpsertVariantsFromExternalCommand,
    UpsertVariantsResult,
} from '../../interfaces'

export default class UpsertVariantsFromExternalUseCase implements IUpsertVariantsFromExternal {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
    ) {}

    async execute(command: UpsertVariantsFromExternalCommand): Promise<UpsertVariantsResult> {
        const items = new Map(command.items.map((i) => [i.externalId, i]))

        const existing = await this.variants.findByExternalIds(command.source, [...items.keys()])
        const existingByExternalId = new Map(existing.map((v) => [v.externalId, v]))

        const changed: Variant[] = []
        const rejectedExternalIds: string[] = []
        let created = 0
        let updated = 0
        let unchanged = 0

        for (const [externalId, { externalId: _id, ...snapshot }] of items) {
            try {
                const current = existingByExternalId.get(externalId)
                if (!current) {
                    changed.push(Variant.createFromExternal(command.source, externalId, snapshot))
                    created++
                } else if (current.isUpToDate(snapshot)) {
                    unchanged++
                } else {
                    current.applySnapshot(snapshot)
                    changed.push(current)
                    updated++
                }
            } catch (error) {
                if (!(error instanceof AppError)) throw error
                rejectedExternalIds.push(externalId)
            }
        }

        const unpublished = await collectProductsToUnpublish(this.products, this.variants, changed)
        if (changed.length > 0) {
            await this.products.saveChanges({ products: unpublished, variants: changed })
        }

        return {
            created,
            updated,
            unchanged,
            rejectedExternalIds,
            unpublishedProductIds: unpublished.map((p) => p.id),
        }
    }
}