import {Inject, Injectable} from '@nestjs/common'

import {IReplaceProductStats} from '@api/product/application'
import {REPLACE_PRODUCT_STATS} from '@common/di'

import {IProductStatsSink, ProductStatsItem, ProductStatsOutcome} from '../../application'

@Injectable()
export class ProductStatsSink implements IProductStatsSink {
    constructor(@Inject(REPLACE_PRODUCT_STATS) private readonly replaceStats: IReplaceProductStats) {
    }

    replace(items: ProductStatsItem[]): Promise<ProductStatsOutcome> {
        return this.replaceStats.execute({items})
    }
}
