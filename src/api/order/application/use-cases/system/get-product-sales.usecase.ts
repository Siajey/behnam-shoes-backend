import { IOrderRepository, ProductUnitsSold } from '@api/order/domain'
import { IGetProductSales } from '../../interfaces'

export default class GetProductSalesUseCase implements IGetProductSales {
    constructor(private readonly orders: IOrderRepository) {}
    execute(since: Date): Promise<ProductUnitsSold[]> { return this.orders.unitsSoldByProduct(since) }
}
