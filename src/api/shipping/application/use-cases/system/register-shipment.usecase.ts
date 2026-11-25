import {
  IShipmentRepository, IShippingMethodRepository, InvalidTrackingCodeError, normalizeTrackingCode,
  Shipment, ShipmentVersionConflictError, ShippingMethodNotFoundError,
} from '@api/shipping/domain'

import { toShipmentSummary, withShipmentRetry } from '../../helpers'
import { IRegisterShipment, RegisterShipmentCommand, ShipmentSummary } from '../../interfaces'
import { IShippingCarrierRegistry } from '../../ports'

export default class RegisterShipmentUseCase implements IRegisterShipment {
  constructor(
    private readonly methods: IShippingMethodRepository,
    private readonly shipments: IShipmentRepository,
    private readonly registry: IShippingCarrierRegistry,
  ) {}

  execute(command: RegisterShipmentCommand): Promise<ShipmentSummary> {
    return withShipmentRetry(async () => {
      // a method that was deactivated since the order was placed still works here
      const method = await this.methods.findByCode(command.methodCode)
      if (!method) throw new ShippingMethodNotFoundError({ code: command.methodCode })

      const carrier = this.registry.get(method.carrier)
      const trackingCode = normalizeTrackingCode(command.trackingCode)
      if (carrier.isValidTrackingCode && !carrier.isValidTrackingCode(trackingCode)) {
        throw new InvalidTrackingCodeError(carrier.name)
      }

      const existing = await this.shipments.findByOrderId(command.orderId)
      if (existing) {
        const same = existing.trackingCode === trackingCode && existing.carrier === carrier.name
        if (!same) {
          existing.reassign({ methodCode: method.code, carrier: carrier.name, trackingCode })
          await this.shipments.save(existing)
        }
        return toShipmentSummary(existing, this.registry)
      }

      const shipment = Shipment.register({
        orderId: command.orderId,
        methodCode: method.code,
        carrier: carrier.name,
        trackingCode,
      })
      // lost a race with another registration: run again, it will find the existing one
      if (!(await this.shipments.create(shipment))) throw new ShipmentVersionConflictError()
      return toShipmentSummary(shipment, this.registry)
    })
  }
}
