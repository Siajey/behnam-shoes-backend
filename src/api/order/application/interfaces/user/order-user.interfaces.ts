import { Order, OrderPage } from '@api/order/domain'
import { ListQuery } from '@common/dto'
import { OrderShipmentInfo } from "../../ports"

export interface PlaceOrderCommand {
    addressId: string
    shippingMethod: string
    idempotencyKey: string
    expectedTotal?: number
}

export interface IPlaceOrder {
  execute(command: PlaceOrderCommand, userId: string): Promise<Order>
}
export interface IListMyOrders {
  execute(userId: string, query: ListQuery<never>): Promise<OrderPage>
}
export interface ICancelMyOrder {
  execute(orderId: string, userId: string): Promise<Order>
}
export interface OrderDetail {
    order: Order
    shipment: OrderShipmentInfo | null
}

export interface IGetMyOrder {
    execute(orderId: string, userId: string): Promise<OrderDetail>
}