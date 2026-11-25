import { Shipment } from '../entities'

export interface IShipmentRepository {
  findByOrderId(orderId: string): Promise<Shipment | null>
  findByOrderIds(orderIds: string[]): Promise<Shipment[]>
  create(shipment: Shipment): Promise<boolean>
  save(shipment: Shipment): Promise<void>
  findDueForPolling(input: {
    now: Date
    limit: number
    carriers: string[]
    createdAfter: Date
  }): Promise<Shipment[]>
  findDeliveredOrderIds(since: Date, limit: number): Promise<string[]>
}
