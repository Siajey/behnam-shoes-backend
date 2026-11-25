export interface OrderShipmentInfo {
  orderId: string
  carrier: string
  trackingCode: string
  trackingUrl: string | null
  autoTracked: boolean
  status: string
  deliveredAt: Date | null
  events: { status: string; description: string; location: string | null; occurredAt: Date }[]
}

export interface IOrderShipments {
  register(input: { orderId: string; methodCode: string; trackingCode: string }): Promise<OrderShipmentInfo>
  findByOrderIds(orderIds: string[]): Promise<OrderShipmentInfo[]>
  listDeliveredOrderIds(since: Date, limit: number): Promise<string[]>
}
