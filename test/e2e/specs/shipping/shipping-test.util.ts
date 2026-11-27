import {Api, expectError, randomId} from '../../util/test.util'
import {Customer} from '../order/order-test.util'

export const GILAN = '\u06AF\u06CC\u0644\u0627\u0646'
export const GILAN_ARABIC_YEH = '\u06AF\u064A\u0644\u0627\u0646'
export const ISFAHAN = '\u0627\u0635\u0641\u0647\u0627\u0646'
export const MAHABAD = '\u0645\u0647\u0627\u0628\u0627\u062F'
export const AZARBAIJAN_GHARBI = '\u0622\u0630\u0631\u0628\u0627\u06CC\u062C\u0627\u0646 \u063A\u0631\u0628\u06CC'

export const RATE_TABLE = {
    post: {
        baseFee: 1000,
        perKgFee: 100,
        sameProvinceBaseFee: 500,
        minDays: 2,
        maxDays: 4,
    },
    express: {
        baseFee: 2000,
        perKgFee: 1000,
        sameProvinceBaseFee: 1000,
        minDays: 1,
        maxDays: 3,
    } as const
}

export interface CreatedShippingMethod {
    id: string
    code: string
    name: string
    description: string | null
    carrier: string
    service: string
    isActive: boolean
    position: number
    fallbackFee: number | null
    freeThreshold: number | null
    handlingFee: number
}

export function methodTracker(admin: Api) {
    const createdIds: string[] = []

    const create = async (overrides: Record<string, unknown> = {}): Promise<CreatedShippingMethod> => {
        const suffix = randomId().replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
        const payload = {
            code: `m_${suffix}`,
            name: `Method ${suffix}`,
            description: null,
            carrier: 'rate_table',
            service: 'post',
            isActive: true,
            position: 0,
            fallbackFee: null,
            freeThreshold: null,
            handlingFee: 0,
            ...overrides,
        }
        const res = await admin.post('/admin/shipping-methods', payload)
        if (res.statusCode !== 201) {
            expectError(res, 201, 'SHIPPING_METHOD_CREATE_SUCCESS')
        }
        const method = res.json().data as CreatedShippingMethod
        createdIds.push(method.id)
        return method
    }

    const cleanup = async () => {
        while (createdIds.length > 0) {
            const id = createdIds.pop()!
            await admin.delete(`/admin/shipping-methods/${id}`)
        }
    }

    return {create, cleanup}
}

export async function addAddress(customer: Customer, province: string, city = 'City'): Promise<string> {
    const res = await customer.api.post('/users/me/addresses', {
        postalCode: '1234567890',
        province,
        city,
        street: 'Main Street 10',
    })
    return res.json().data.id as string
}

/** The shipping fee the rate table gives for `units` units  */
export const rateFor = (
    service: 'post' | 'express',
    units: number,
    sameProvince = false,
    handlingFee = 0,
): number => {
    const entry = RATE_TABLE[service] as { baseFee: number; perKgFee: number; sameProvinceBaseFee?: number }

    const kilograms = Math.max(
        1,
        Math.ceil((units * 1500 + (units > 0 ? 500 : 0)) / 1000),
    )

    const baseFee =
        sameProvince && entry.sameProvinceBaseFee !== undefined
            ? entry.sameProvinceBaseFee
            : entry.baseFee
    return baseFee + (kilograms - 1) * entry.perKgFee + handlingFee
}
/** Creates the standard `post` and `express` methods once (idempotent). Order and payment specs call it in beforeAll. */
export const ensureShippingMethods = async (admin: Api) => {
    const existing = ((await admin.get('/admin/shipping-methods')).json().data as { code: string }[]).map((m) => m.code)
    if (!existing.includes('post')) await methodTracker(admin).create({
        code: 'post',
        name: 'Post',
        service: 'post',
        position: 0
    })
    if (!existing.includes('express')) await methodTracker(admin).create({
        code: 'express',
        name: 'Express',
        service: 'express',
        position: 1
    })
}
