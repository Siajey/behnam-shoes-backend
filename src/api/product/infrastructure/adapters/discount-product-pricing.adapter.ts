import { Inject, Injectable } from '@nestjs/common'

import { IPriceCatalog } from '@api/discount/application'
import { PRICE_CATALOG } from '@common/di'
import {IProductPricing, PricingProduct} from "@api/product/application";


@Injectable()
export class DiscountProductPricing implements IProductPricing {
    constructor(@Inject(PRICE_CATALOG) private readonly priceCatalog: IPriceCatalog) {}

    async finalPrices(products: PricingProduct[]): Promise<Map<string, number>> {
        const lines = products.flatMap((p) =>
            p.variants.map((v) => ({
                variantId: v.variantId,
                productId: p.productId,
                categoryId: p.categoryId,
                brandId: p.brandId,
                unitPrice: v.price,
                quantity: 1,
            })),
        )
        if (lines.length === 0) return new Map()

        const result = await this.priceCatalog.execute({ lines })
        return new Map(result.lines.map((l) => [l.variantId, l.unitPrice]))
    }
}