import { IOrderRepository, OrderNotFoundError } from '@api/order/domain'

import { IGetMyOrder, OrderDetail } from '../../interfaces/user'
import { IOrderShipments } from '../../ports'

export default class GetMyOrderUseCase implements IGetMyOrder {
    constructor(
        private readonly orders: IOrderRepository,
        private readonly shipments: IOrderShipments,
    ) {}

    async execute(orderId: string, userId: string): Promise<OrderDetail> {
        const order = await this.orders.findById(orderId)
        if (!order || order.userId !== userId) throw new OrderNotFoundError({ orderId })

        const [shipment] = await this.shipments.findByOrderIds([order.id])
        return { order, shipment: shipment ?? null }
    }
}