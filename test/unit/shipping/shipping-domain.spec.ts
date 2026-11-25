import {describe, expect, it} from '@jest/globals'

import {normalizePlace, ShippingMethod} from '@api/shipping/domain'

const create = (over: Record<string, unknown> = {}) =>
    ShippingMethod.create({code: 'post', name: 'Post', carrier: 'rate_table', service: 'post', ...over} as any)
const invalid = (reason: string) => ({code: 'SHIPPING_INVALID_METHOD', status: 400, details: {reason}})

describe('ShippingMethod', () => {
    it('applies defaults and trims text', () => {
        const m = create({name: '  Post  ', description: '  ', service: ' post '})

        expect(m).toMatchObject({code: 'post', name: 'Post', description: null, service: 'post', isActive: true, position: 0, fallbackFee: null, freeThreshold: null, handlingFee: 0})
        expect(m.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it.each([
        ['code', {code: 'Post'}],
        ['code', {code: '1post'}],
        ['code', {code: 'a'}],
        ['code', {code: 'a'.repeat(31)}],
        ['name', {name: ''}],
        ['name', {name: 'n'.repeat(61)}],
        ['description', {description: 'd'.repeat(201)}],
        ['carrier', {carrier: 'Rate-Table'}],
        ['service', {service: ' '}],
        ['service', {service: 's'.repeat(51)}],
        ['position', {position: -1}],
        ['position', {position: 1.5}],
        ['fallbackFee', {fallbackFee: -1}],
        ['fallbackFee', {fallbackFee: 0.5}],
        ['freeThreshold', {freeThreshold: 0}],
        ['handlingFee', {handlingFee: -1}],
    ])('rejects an invalid %s', (reason, over) => {
        expect(() => create(over)).toThrow(expect.objectContaining(invalid(reason)))
    })

    it('accepts boundary values', () => {
        expect(() => create({fallbackFee: 0, freeThreshold: 1, handlingFee: 0, position: 0, code: 'ab'})).not.toThrow()
    })

    describe('update', () => {
        it('ignores undefined, clears with null and keeps the code', () => {
            const m = create({description: 'x', fallbackFee: 10, freeThreshold: 5})

            m.update({name: 'New', description: null, fallbackFee: undefined, freeThreshold: null})

            expect(m).toMatchObject({code: 'post', name: 'New', description: null, fallbackFee: 10, freeThreshold: null})
        })

        it('validates the merged result and changes nothing when it fails', () => {
            const m = create({handlingFee: 5})

            expect(() => m.update({name: 'Ok', position: -1})).toThrow(expect.objectContaining(invalid('position')))

            expect(m).toMatchObject({name: 'Post', handlingFee: 5})
        })

        it('advances updatedAt', async () => {
            const m = create()
            const before = m.updatedAt.getTime()
            await new Promise((r) => setTimeout(r, 5))

            m.update({position: 2})

            expect(m.updatedAt.getTime()).toBeGreaterThan(before)
        })
    })
})

describe('normalizePlace', () => {
    const base = {postalCode: '1234567890', province: 'P', city: 'C'}

    it.each([
        ['Persian digits', '\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9\u06F0'],
        ['Arabic digits', '\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660'],
        ['dashes and spaces', ' 12345-67890 '],
    ])('accepts a postal code with %s', (_label, postalCode) => {
        expect(normalizePlace({...base, postalCode}).postalCode).toBe('1234567890')
    })

    it.each(['', '123', '12345678901', 'abcdefghij', '12345 6789a'])('rejects the postal code %p', (postalCode) => {
        expect(() => normalizePlace({...base, postalCode})).toThrow(
            expect.objectContaining({code: 'SHIPPING_INVALID_DESTINATION', status: 400, details: {field: 'postalCode'}}),
        )
    })

    it('trims province and city and converts Arabic kaf/yeh to the Persian letters', () => {
        const result = normalizePlace({...base, province: ' \u06AF\u064A\u0644\u0627\u0646 ', city: ' \u0643 '})

        expect(result).toMatchObject({province: '\u06AF\u06CC\u0644\u0627\u0646', city: '\u06A9'})
    })
})
