import {
    IProductRepository,
    IVariantRepository,
    Product,
    ProductNotFoundError,
    ProductWithVariants,
    VariantNotFoundError,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { unpublishIfNoActiveVariants } from '../../../helpers'
import { IMoveVariants, MoveVariantsCommand, MoveVariantsResult } from '../../../interfaces'

export default class MoveVariantsUseCase implements IMoveVariants {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: MoveVariantsCommand, actorId: string): Promise<MoveVariantsResult> {
        const target = await this.products.findById(command.targetProductId)
        if (!target) throw new ProductNotFoundError({ id: command.targetProductId })

        const ids = [...new Set(command.variantIds)]
        const found = await this.variants.findByIds(ids)
        const foundIds = new Set(found.map((v) => v.id))
        const missing = ids.filter((id) => !foundIds.has(id))
        if (missing.length) throw new VariantNotFoundError({ ids: missing })

        const moving = found.filter((v) => v.productId !== target.id)
        target.assertAcceptsVariants(moving)

        const movingIds = new Set(moving.map((v) => v.id))
        const sourceIds = [
            ...new Set(moving.map((v) => v.productId).filter((id): id is string => id !== null)),
        ]

        const unpublished: Product[] = []
        for (const sourceId of sourceIds) {
            const source = await this.products.findById(sourceId)
            if (!source) continue
            const remaining = (await this.variants.findByProductId(sourceId)).filter(
                (v) => !movingIds.has(v.id),
            )
            if (unpublishIfNoActiveVariants(source, remaining)) unpublished.push(source)
        }

        if (moving.length > 0) {
            moving.forEach((v) => v.assignTo(target.id))
            await this.products.saveChanges({ products: unpublished, variants: moving })

            void this.logger.info('Variants moved between products', {
                module: 'MoveVariantsUseCase',
                operation: 'execute',
                event: 'product.variant.move',
                userId: actorId,
                resourceId: target.id,
                data: {
                    variantCount: moving.length,
                    sourceProductIds: sourceIds,
                    unpublishedProductIds: unpublished.map((p) => p.id),
                },
            })
        }

        return {
            target: new ProductWithVariants(target, await this.variants.findByProductId(target.id)),
            unpublishedProductIds: unpublished.map((p) => p.id),
        }
    }
}