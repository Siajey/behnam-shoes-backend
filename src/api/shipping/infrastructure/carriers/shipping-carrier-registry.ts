import { ShippingCarrierNotSupportedError } from '@api/shipping/domain'
import { IShippingCarrier, IShippingCarrierRegistry } from '@api/shipping/application'

export class ShippingCarrierRegistry implements IShippingCarrierRegistry {
  private readonly byName: Map<string, IShippingCarrier>

  constructor(carriers: readonly IShippingCarrier[]) {
    this.byName = new Map(carriers.map((c) => [c.name, c]))
  }

  get(name: string): IShippingCarrier {
    const carrier = this.byName.get(name)
    if (!carrier) throw new ShippingCarrierNotSupportedError(name)
    return carrier
  }

  has(name: string): boolean {
    return this.byName.has(name)
  }

  names(): string[] {
    return [...this.byName.keys()]
  }
}
