import {describe, expect, it, jest} from '@jest/globals'

import {RateTableCarrier} from '@api/shipping/infrastructure'

const TABLE = {
    post: {baseFee: 90000, perKgFee: 25000, sameProvinceBaseFee: 60000, minDays: 3, maxDays: 7},
    plain: {baseFee: 50000, perKgFee: 10000},
}
const carrierWith = (raw: string | undefined) => {
    const getOptional = jest.fn(() => raw)
    return {carrier: new RateTableCarrier({getOptional} as any), getOptional}
}
const place = (province: string) => ({postalCode: '1234567890', province, city: 'c'})
const request = (service: string, weightGrams: number, destProvince = 'B') => ({
    service,
    origin: place('A'),
    destination: place(destProvince),
    parcel: {weightGrams, declaredValue: 1},
})

describe('RateTableCarrier', () => {
    const {carrier} = carrierWith(JSON.stringify(TABLE))

    it('is named rate_table', () => expect(carrier.name).toBe('rate_table'))

    it.each([
        [0, 90000], // an empty parcel still counts as 1 kg
        [1, 90000],
        [1000, 90000],
        [1001, 115000], // started kilograms are charged
        [2000, 115000],
        [2001, 140000],
        [10_000, 315000],
    ])('prices %d g at %d', async (grams, fee) => {
        expect((await carrier.quote(request('post', grams))).fee).toBe(fee)
    })

    it('uses the same-province base fee only when the service defines one', async () => {
        expect((await carrier.quote(request('post', 1500, 'A'))).fee).toBe(85000)
        expect((await carrier.quote(request('plain', 1500, 'A'))).fee).toBe(60000)
    })

    it('reports delivery days only when both bounds are configured', async () => {
        expect((await carrier.quote(request('post', 1))).estimatedDays).toEqual({min: 3, max: 7})
        expect((await carrier.quote(request('plain', 1))).estimatedDays).toBeNull()
    })

    it.each([
        ['an unknown service', JSON.stringify(TABLE), 'nope', 'unknown_service'],
        ['no table configured', undefined, 'post', 'unknown_service'],
        ['invalid JSON', '{not json', 'post', 'invalid_rate_table'],
    ])('fails as a carrier error for %s', async (_label, raw, service, code) => {
        const failing = carrierWith(raw).carrier

        await expect(failing.quote(request(service, 1))).rejects.toMatchObject({
            code: 'SHIPPING_CARRIER_FAILED',
            status: 502,
            details: {carrier: 'rate_table', stage: 'quote', code, retryable: false},
        })
    })

    it('reads the configuration only once', async () => {
        const {carrier: once, getOptional} = carrierWith(JSON.stringify(TABLE))

        await once.quote(request('post', 1))
        await once.quote(request('post', 1))

        expect(getOptional).toHaveBeenCalledTimes(1)
    })
})
