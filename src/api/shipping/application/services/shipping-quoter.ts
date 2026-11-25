import {
    EstimatedDays,
    Parcel,
    QuoteSource,
    RATE_TABLE_CARRIER,
    ShippingCarrierError,
    ShippingCarrierNotSupportedError,
    ShippingMethod,
    ShippingPlace,
    ShippingQuote,
    ShippingQuoteUnavailableError,
} from '@api/shipping/domain'
import {ILogger} from '@common/logger'

import {IQuoteCache, IShippingCarrierRegistry, IShippingOrigin} from '../ports'

export interface QuoteInput {
    destination: ShippingPlace
    parcel: Parcel
    subtotalAfterDiscounts: number
}

export class ShippingQuoter {
    constructor(
        private readonly registry: IShippingCarrierRegistry,
        private readonly cache: IQuoteCache,
        private readonly origin: IShippingOrigin,
        private readonly logger: ILogger,
    ) {
    }

    async quote(method: ShippingMethod, input: QuoteInput): Promise<ShippingQuote> {
        let fee: number
        let estimatedDays: EstimatedDays | null
        let source: QuoteSource
        try {
            const origin = this.origin.get()
            const carrier = this.registry.get(method.carrier)
            const priced = carrier.quote ? carrier : this.registry.get(RATE_TABLE_CARRIER)
            const request = {
                service: method.service,
                origin,
                destination: input.destination,
                parcel: input.parcel,
            }
            const key = [
                priced.name,
                method.service,
                origin.postalCode,
                input.destination.postalCode,
                input.parcel.weightGrams,
                input.parcel.declaredValue,
            ].join(':')

            const carrierQuote = await this.cache.getOrLoad(key, () => priced.quote!(request))
            fee = carrierQuote.fee + method.handlingFee
            estimatedDays = carrierQuote.estimatedDays
            source = 'carrier'
        } catch (error) {
            if (
                !(error instanceof ShippingCarrierError) &&
                !(error instanceof ShippingCarrierNotSupportedError)
            ) {
                throw error
            }
            if (method.fallbackFee === null) throw new ShippingQuoteUnavailableError(method.code)

            void this.logger.warn('The carrier could not quote, the fallback fee is used', {
                module: 'ShippingQuoter',
                operation: 'quote',
                event: 'shipping.quote.fallback',
                data: {methodCode: method.code, carrier: method.carrier},
                err: error,
            })
            fee = method.fallbackFee
            estimatedDays = null
            source = 'fallback'
        }

        const isFree =
            method.freeThreshold !== null && input.subtotalAfterDiscounts >= method.freeThreshold

        return {
            methodCode: method.code,
            name: method.name,
            description: method.description,
            fee: isFree ? 0 : fee,
            isFree,
            estimatedDays,
            source,
        }
    }
}