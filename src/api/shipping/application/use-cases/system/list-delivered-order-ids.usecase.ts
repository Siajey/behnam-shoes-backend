import { IShipmentRepository } from '@api/shipping/domain'

import { IListDeliveredOrderIds } from '../../interfaces'

export default class ListDeliveredOrderIdsUseCase implements IListDeliveredOrderIds {
  constructor(private readonly shipments: IShipmentRepository) {}

  execute(since: Date, limit: number): Promise<string[]> {
    return this.shipments.findDeliveredOrderIds(since, limit)
  }
}
