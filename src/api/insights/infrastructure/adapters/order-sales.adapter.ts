import {Inject, Injectable} from '@nestjs/common'

import {IGetProductSales} from '@api/order/application'
import {GET_PRODUCT_SALES} from '@common/di'

import {IProductSalesSource, ProductSalesRow} from '../../application'

@Injectable()
export class OrderSalesSource implements IProductSalesSource {
    constructor(@Inject(GET_PRODUCT_SALES) private readonly getSales: IGetProductSales) {
    }

    async unitsSoldSince(since: Date): Promise<ProductSalesRow[]> {
        const rows = await this.getSales.execute(since);
        return rows.map((r) => ({
            productId: r.productId, unitsSold: r.unitsSold
        }))
    }
}
