import {PaymentGatewayNotSupportedError} from '@api/payment/domain'
import {IPaymentGateway, IPaymentGatewayRegistry} from '@api/payment/application'

export class PaymentGatewayRegistry implements IPaymentGatewayRegistry {
    private readonly byName: Map<string, IPaymentGateway>

    constructor(gateways: readonly IPaymentGateway[], private readonly defaultGateway: string) {
        this.byName = new Map(gateways.map(g => [g.name, g]))
    }

    get(name: string): IPaymentGateway {
        const gateway = this.byName.get(name);
        if (!gateway) throw new PaymentGatewayNotSupportedError(name);
        return gateway
    }

    defaultName(): string {
        return this.defaultGateway
    }
}
