import { AdminOrderListCriteria, Order, OrderPage } from '@api/order/domain'

export type UpdateOrderStatusCommand = { orderId: string } & (
  | { action: 'startProcessing'; note?: string | null }
  | { action: 'ship'; carrier?: string | null; trackingCode?: string | null; note?: string | null }
  | { action: 'deliver'; note?: string | null }
  | { action: 'cancel'; note?: string | null }
)

export interface IAdminListOrders {
  execute(criteria: AdminOrderListCriteria): Promise<OrderPage>
}
export interface IAdminGetOrder {
  execute(orderId: string): Promise<Order>
}
export interface IUpdateOrderStatus {
  execute(command: UpdateOrderStatusCommand, actorId: string): Promise<Order>
}
