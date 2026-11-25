import {AdminOrderListCriteria, Order, OrderPage} from '@api/order/domain'

import {OrderDetail} from "../user";

export type UpdateOrderStatusCommand = { orderId: string } & (
    | { action: 'startProcessing'; note?: string | null }
    | { action: 'ship'; carrier?: string | null; trackingCode?: string | null; note?: string | null }
    | { action: 'deliver'; note?: string | null }
    | { action: 'cancel'; note?: string | null }
    | { orderId: string; action: 'ship'; carrier?: string; trackingCode?: string; note?: string }
    | { orderId: string; action: 'updateTracking'; trackingCode: string; note?: string }
    )

export interface IAdminListOrders {
    execute(criteria: AdminOrderListCriteria): Promise<OrderPage>
}

export interface IUpdateOrderStatus {
    execute(command: UpdateOrderStatusCommand, actorId: string): Promise<Order>
}

export interface IAdminGetOrder {
    execute(orderId: string): Promise<OrderDetail>
}
