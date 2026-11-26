import {IOrderRepository, Order, OrderNotFoundError} from '@api/order/domain'

import {IAdminGetOrder, OrderDetail} from '../../interfaces'
import {IOrderShipments} from "@api/order/application";

export default class AdminGetOrderUseCase implements IAdminGetOrder {
    constructor(
        private readonly orders: IOrderRepository,
        private readonly shipments: IOrderShipments
    ) {
    }

    async execute(orderId: string): Promise<OrderDetail> {
        const order = await this.orders.findById(orderId)
        if (!order) throw new OrderNotFoundError({id: orderId})

        const [shipment] = await this.shipments.findByOrderIds([order.id])
        return {
            order: order,
            shipment: shipment
        }
    }
}
