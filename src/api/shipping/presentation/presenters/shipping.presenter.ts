import {ShippingMethod, ShippingOption} from '@api/shipping/domain'

export class ShippingPresenter {
    static option(o: ShippingOption) {
        if (!o.available) {
            return {
                methodCode: o.methodCode,
                name: o.name,
                description: o.description,
                available: false
            }
        }
        return {
            methodCode: o.methodCode,
            name: o.name,
            description: o.description,
            available: true,
            fee: o.fee,
            isFree: o.isFree,
            estimatedDays: o.estimatedDays,
        }
    }

    static method(m: ShippingMethod) {
        return {
            id: m.id,
            code: m.code,
            name: m.name,
            description: m.description,
            carrier: m.carrier,
            service: m.service,
            isActive: m.isActive,
            position: m.position,
            fallbackFee: m.fallbackFee,
            freeThreshold: m.freeThreshold,
            handlingFee: m.handlingFee,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
        }
    }
}
