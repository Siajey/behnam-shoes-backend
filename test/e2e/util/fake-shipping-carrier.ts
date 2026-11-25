import {CarrierQuote, CarrierQuoteRequest, CarrierShipmentRequest, CarrierTracking, IShippingCarrier} from '@api/shipping/application'
import {ShippingCarrierError} from '@api/shipping/domain'

export class FakeShippingCarrier implements IShippingCarrier {
    quote?: (request: CarrierQuoteRequest) => Promise<CarrierQuote>
    isValidTrackingCode?: (code: string) => boolean
    quoteRequests: CarrierQuoteRequest[] = []
    shipmentRequests: CarrierShipmentRequest[] = []
    trackCalls: string[] = []
    private quoteResult: () => CarrierQuote | Error = () => ({fee: 70000, estimatedDays: {min: 2, max: 4}})
    private trackings = new Map<string, CarrierTracking | Error>()
    private shipmentError: Error | null = null

    /** `quotes: false` gives a carrier without a price API (priced by the rate table). */
    constructor(readonly name = 'fake', options: {quotes?: boolean; validCode?: RegExp} = {}) {
        if (options.quotes !== false) {
            this.quote = async (request) => {
                this.quoteRequests.push(request)
                const result = this.quoteResult()
                if (result instanceof Error) throw result
                return result
            }
        }
        if (options.validCode) this.isValidTrackingCode = (code) => options.validCode!.test(code.trim())
    }

    async createShipment(request: CarrierShipmentRequest) {
        this.shipmentRequests.push(request)
        if (this.shipmentError) throw this.shipmentError
        return {trackingCode: `FAKE-${request.reference.slice(0, 8)}`}
    }

    async track(trackingCode: string): Promise<CarrierTracking> {
        this.trackCalls.push(trackingCode)
        const result = this.trackings.get(trackingCode)
        if (result instanceof Error) throw result
        return result ?? {status: 'created', events: []}
    }

    respondWith(fee: number, estimatedDays: {min: number; max: number} | null = null) { this.quoteResult = () => ({fee, estimatedDays}) }
    failQuotes(retryable = true) { this.quoteResult = () => new ShippingCarrierError({carrier: this.name, stage: 'quote', code: 'down', retryable}) }
    crashQuotes() { this.quoteResult = () => new Error('boom') } // our own bug: must never be hidden by a fallback
    setTracking(code: string, tracking: CarrierTracking | Error) { this.trackings.set(code, tracking) }
    failShipments() { this.shipmentError = new ShippingCarrierError({carrier: this.name, stage: 'create_shipment', retryable: true}) }
    reset() {
        this.quoteRequests = []; this.shipmentRequests = []; this.trackCalls = []
        this.quoteResult = () => ({fee: 70000, estimatedDays: {min: 2, max: 4}})
        this.trackings.clear(); this.shipmentError = null
    }
}

export const fakeShippingCarrier = new FakeShippingCarrier('fake') // a pricing carrier
/** Stands in for Tipax in e2e (no network): tracking only, priced by the rate table. */
export const fakeTipax = new FakeShippingCarrier('tipax', {quotes: false, validCode: /^[a-zA-Z0-9]{10,18}$/})