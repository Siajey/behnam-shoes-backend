import { IProductRepository, IVariantRepository } from '@api/product/domain'
import { ILogger } from '@common/logger'

import { collectProductsToUnpublish } from '../../helpers'
import {
    DeactivateMissingVariantsCommand,
    DeactivateMissingVariantsResult,
    IDeactivateMissingVariants,
} from '../../interfaces'

export default class DeactivateMissingVariantsUseCase implements IDeactivateMissingVariants {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: DeactivateMissingVariantsCommand): Promise<DeactivateMissingVariantsResult> {
        if (command.presentExternalIds.length === 0) {
            void this.logger.warn('Variant deactivation skipped: the external source returned no items', {
                module: 'DeactivateMissingVariantsUseCase',
                operation: 'execute',
                event: 'variant.deactivate',
                data: { source: command.source },
            })
            return { deactivated: 0, unpublishedProductIds: [] }
        }

        const present = new Set(command.presentExternalIds)
        const missing = (await this.variants.findActiveBySource(command.source)).filter(
            (v) => !present.has(v.externalId),
        )
        if (missing.length === 0) return { deactivated: 0, unpublishedProductIds: [] }

        missing.forEach((v) => v.deactivate())
        const unpublished = await collectProductsToUnpublish(this.products, this.variants, missing)
        await this.products.saveChanges({ products: unpublished, variants: missing })

        void this.logger.info('Variants deactivated: missing from the external source', {
            module: 'DeactivateMissingVariantsUseCase',
            operation: 'execute',
            event: 'variant.deactivate',
            data: {
                source: command.source,
                count: missing.length,
                unpublishedProductIds: unpublished.map((p) => p.id),
            },
        })
        return { deactivated: missing.length, unpublishedProductIds: unpublished.map((p) => p.id) }
    }
}