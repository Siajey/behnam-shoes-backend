import { Parcel, ShippingPlace, TrackingStatus } from '@api/shipping/domain'

export interface CarrierQuoteRequest {
    service: string
    origin: ShippingPlace
    destination: ShippingPlace
    parcel: Parcel
}

export interface CarrierQuote {
    fee: number
    estimatedDays: { min: number; max: number } | null
}

export interface CarrierShipmentRequest {
    reference: string
    service: string
    origin: ShippingPlace
    destination: ShippingPlace
    recipient: { firstName: string; lastName: string; phoneNumber: string; addressLine: string }
    parcel: Parcel
}

export interface CarrierTrackingEvent {
    key: string
    status: TrackingStatus
    description: string
    location: string | null
    occurredAt: Date
}

export interface CarrierTracking {
    status: TrackingStatus
    events: CarrierTrackingEvent[]
}

export interface IShippingCarrier {
    readonly name: string
    quote?(request: CarrierQuoteRequest): Promise<CarrierQuote>
    createShipment?(request: CarrierShipmentRequest): Promise<{ trackingCode: string }>
    track?(trackingCode: string): Promise<CarrierTracking>
    isValidTrackingCode?(code: string): boolean
    trackingUrl?(code: string): string | null
}

export interface IShippingCarrierRegistry {
    get(name: string): IShippingCarrier
    has(name: string): boolean
    names(): string[]
}