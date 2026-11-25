import {ParcelLine, ShippingPlace, ShippingQuote, TrackingStatus} from '@api/shipping/domain'

export interface QuoteShippingCommand {
  methodCode: string
  destination: ShippingPlace
  lines: ParcelLine[]
  subtotalAfterDiscounts: number
}

export interface IQuoteShipping {
  execute(command: QuoteShippingCommand): Promise<ShippingQuote>
}

export interface ShipmentSummary {
    orderId: string
    methodCode: string
    carrier: string
    trackingCode: string
    trackingUrl: string | null
    autoTracked: boolean
    status: TrackingStatus
    deliveredAt: Date | null
    lastCheckedAt: Date | null
    events: { status: TrackingStatus; description: string; location: string | null; occurredAt: Date }[]
}

export interface RegisterShipmentCommand {
    orderId: string
    methodCode: string
    trackingCode: string
}

export interface IRegisterShipment {
    execute(command: RegisterShipmentCommand): Promise<ShipmentSummary>
}

export interface IGetShipmentsByOrderIds {
    execute(orderIds: string[]): Promise<ShipmentSummary[]>
}

export interface IListDeliveredOrderIds {
    execute(since: Date, limit: number): Promise<string[]>
}

export interface IRefreshShipment {
    execute(orderId: string): Promise<{ summary: ShipmentSummary; outcome: 'updated' | 'unchanged' | 'failed' | 'skipped' }>
}

export interface PollShipmentsResult {
    checked: number
    updated: number
    failed: number
}

export interface IPollShipments {
    execute(): Promise<PollShipmentsResult>
}
