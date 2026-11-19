import { IDiscountRepository, priceLines } from '@api/discount/domain'

import { IPriceCatalog, PriceCatalogCommand, PriceCatalogResult } from '../../interfaces/system'

export default class PriceCatalogUseCase implements IPriceCatalog {
    constructor(private readonly discounts: IDiscountRepository) {}

    async execute(command: PriceCatalogCommand): Promise<PriceCatalogResult> {
        if (command.lines.length === 0) return { lines: [] }

        const now = new Date()
        const result = priceLines({
            lines: command.lines,
            discounts: await this.discounts.findActiveAt(now),
            couponCode: null,
            couponContext: null,
            now,
        })

        return {
            lines: result.lines.map((l) => ({
                variantId: l.variantId,
                originalUnitPrice: l.originalUnitPrice,
                unitPrice: l.unitPrice,
            })),
        }
    }
}