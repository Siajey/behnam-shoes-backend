import { Inject, Injectable } from '@nestjs/common'

import {
    IGetShipmentsByOrderIds, IListDeliveredOrderIds, IRegisterShipment,
} from '@api/shipping/application'
import { GET_SHIPMENTS_BY_ORDER_IDS, LIST_DELIVERED_ORDER_IDS, REGISTER_SHIPMENT } from '@common/di'
import { IOrderShipments, OrderShipmentInfo } from '@api/order/application'

@Injectable()
export class ShippingModuleShipments implements IOrderShipments {
    constructor(
        @Inject(REGISTER_SHIPMENT) private readonly registerShipment: IRegisterShipment,
        @Inject(GET_SHIPMENTS_BY_ORDER_IDS) private readonly getShipments: IGetShipmentsByOrderIds,
        @Inject(LIST_DELIVERED_ORDER_IDS) private readonly listDelivered: IListDeliveredOrderIds,
    ) {}

    register(input: { orderId: string; methodCode: string; trackingCode: string }): Promise<OrderShipmentInfo> {
        return this.registerShipment.execute(input)
    }

    findByOrderIds(orderIds: string[]): Promise<OrderShipmentInfo[]> {
        return this.getShipments.execute(orderIds)
    }

    listDeliveredOrderIds(since: Date, limit: number): Promise<string[]> {
        return this.listDelivered.execute(since, limit)
    }
}