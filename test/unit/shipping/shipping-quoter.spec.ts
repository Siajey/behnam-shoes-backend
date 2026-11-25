import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {ShippingQuoter} from '@api/shipping/application'
import {ShippingCarrierError, ShippingCarrierNotSupportedError, ShippingMethod} from '@api/shipping/domain'

const origin = {postalCode: '1111111111', province: 'A', city: 'a'}
const input = {
    destination: {postalCode: '2222222222', province: 'B', city: 'b'},
    parcel: {weightGrams: 1500, declaredValue: 2000},
    subtotalAfterDiscounts: 2000,
}
const method = (over: Record<string, unknown> = {}) =>
    ShippingMethod.create({code: 'post', name: 'Post', carrier: 'c', service: 'svc', ...over} as any)

describe('ShippingQuoter', () => {
    const carrierQuote = jest.fn<() => Promise<{fee: number; estimatedDays: any}>>()
    const registryGet = jest.fn()
    const getOrLoad = jest.fn(async (_key: string, loader: () => Promise<any>) => loader())
    const warn = jest.fn()
    const quoter = new ShippingQuoter(
        {get: registryGet, has: () => true, names: () => []} as any,
        {getOrLoad} as any,
        {get: () => origin},
        {warn} as any,
    )

    beforeEach(() => {
        jest.clearAllMocks()
        carrierQuote.mockResolvedValue({fee: 100, estimatedDays: {min: 1, max: 2}})
        registryGet.mockReturnValue({name: 'c', quote: carrierQuote})
    })

    it('adds the handling fee to the carrier fee and keeps the estimate', async () => {
        expect(await quoter.quote(method({handlingFee: 25}), input)).toEqual({
            methodCode: 'post', name: 'Post', description: null, fee: 125, isFree: false, estimatedDays: {min: 1, max: 2}, source: 'carrier',
        })
    })

    it('asks the carrier with the method service, the origin, the destination and the parcel', async () => {
        await quoter.quote(method(), input)

        expect(carrierQuote).toHaveBeenCalledWith({service: 'svc', origin, destination: input.destination, parcel: input.parcel})
    })

    it('caches on carrier, service, both postal codes, weight and declared value', async () => {
        await quoter.quote(method(), input)

        expect(getOrLoad).toHaveBeenCalledTimes(1)
        expect(getOrLoad.mock.calls[0][0]).toBe('c:svc:1111111111:2222222222:1500:2000')
    })

    it.each([
        [1999, false, 100],
        [2000, true, 0],
        [9999, true, 0],
    ])('with threshold 2000 a subtotal of %d gives free=%s (fee %d)', async (subtotal, free, fee) => {
        expect(await quoter.quote(method({freeThreshold: 2000}), {...input, subtotalAfterDiscounts: subtotal})).toMatchObject({isFree: free, fee})
    })

    it('is never free without a threshold', async () => {
        expect((await quoter.quote(method(), {...input, subtotalAfterDiscounts: 1e12})).isFree).toBe(false)
    })

    it.each([
        ['a carrier error', () => carrierQuote.mockRejectedValue(new ShippingCarrierError({carrier: 'c', stage: 'quote', retryable: true}))],
        ['an unknown carrier', () => registryGet.mockImplementation(() => { throw new ShippingCarrierNotSupportedError('c') })],
    ])('falls back to the fallback fee on %s, without the handling fee or an estimate', async (_label, arrange) => {
        arrange()

        const result = await quoter.quote(method({fallbackFee: 500, handlingFee: 25}), input)

        expect(result).toMatchObject({fee: 500, estimatedDays: null, source: 'fallback'})
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('applies the free threshold to a fallback fee too', async () => {
        carrierQuote.mockRejectedValue(new ShippingCarrierError({carrier: 'c', stage: 'quote', retryable: true}))

        expect(await quoter.quote(method({fallbackFee: 500, freeThreshold: 1000}), input)).toMatchObject({fee: 0, isFree: true, source: 'fallback'})
    })

    it('throws SHIPPING_QUOTE_UNAVAILABLE when the carrier fails and there is no fallback', async () => {
        carrierQuote.mockRejectedValue(new ShippingCarrierError({carrier: 'c', stage: 'quote', retryable: true}))

        await expect(quoter.quote(method(), input)).rejects.toMatchObject({code: 'SHIPPING_QUOTE_UNAVAILABLE', details: {methodCode: 'post'}})
    })

    it('treats a fallback fee of 0 as a real fallback', async () => {
        carrierQuote.mockRejectedValue(new ShippingCarrierError({carrier: 'c', stage: 'quote', retryable: true}))

        expect(await quoter.quote(method({fallbackFee: 0}), input)).toMatchObject({fee: 0, source: 'fallback'})
    })

    it('rethrows any other error instead of falling back', async () => {
        carrierQuote.mockRejectedValue(new TypeError('bug'))

        await expect(quoter.quote(method({fallbackFee: 500}), input)).rejects.toThrow('bug')
        expect(warn).not.toHaveBeenCalled()
    })
})
