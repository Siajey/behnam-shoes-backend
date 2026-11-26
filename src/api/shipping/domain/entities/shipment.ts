import { randomUUID } from 'node:crypto'

import { ShipmentFinalError } from '../errors'
import { advanceStatus, FINAL_TRACKING_STATUSES, TrackingStatus } from '../value-objects'

const MAX_BACKOFF_MINUTES = 360

export interface ShipmentEvent {
  key: string
  status: TrackingStatus
  description: string
  location: string | null
  occurredAt: Date
}

export interface ShipmentProps {
  id: string
  orderId: string
  methodCode: string
  carrier: string
  trackingCode: string
  status: TrackingStatus
  events: ShipmentEvent[]
  deliveredAt: Date | null
  lastCheckedAt: Date | null
  nextCheckAt: Date
  failureCount: number
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface RegisterShipmentInput {
  orderId: string
  methodCode: string
  carrier: string
  trackingCode: string
}

export interface TrackingUpdate {
  status: TrackingStatus
  events: ShipmentEvent[]
}

export class Shipment {
  private constructor(private props: ShipmentProps) {}

  static register(input: RegisterShipmentInput): Shipment {
    const now = new Date()
    return new Shipment({
      id: randomUUID(),
      ...input,
      status: 'created',
      events: [],
      deliveredAt: null,
      lastCheckedAt: null,
      nextCheckAt: now, // due for its first check right away
      failureCount: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: ShipmentProps): Shipment {
    return new Shipment(props)
  }

  get id() { return this.props.id }
  get orderId() { return this.props.orderId }
  get methodCode() { return this.props.methodCode }
  get carrier() { return this.props.carrier }
  get trackingCode() { return this.props.trackingCode }
  get status() { return this.props.status }
  get events(): readonly ShipmentEvent[] { return this.props.events }
  get deliveredAt() { return this.props.deliveredAt }
  get lastCheckedAt() { return this.props.lastCheckedAt }
  get nextCheckAt() { return this.props.nextCheckAt }
  get failureCount() { return this.props.failureCount }
  get version() { return this.props.version }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  get isFinal(): boolean {
    return FINAL_TRACKING_STATUSES.includes(this.props.status)
  }

  /** The admin fixed a wrong code or carrier: start over. A finished parcel can't be changed. */
  reassign(input: Omit<RegisterShipmentInput, 'orderId'>): void {
    if (this.isFinal) throw new ShipmentFinalError()
    const now = new Date()
    Object.assign(this.props, {
      ...input,
      status: 'created',
      events: [],
      deliveredAt: null,
      lastCheckedAt: null,
      nextCheckAt: now,
      failureCount: 0,
      updatedAt: now,
    })
  }

  applyTracking(update: TrackingUpdate, now: Date, intervalMinutes: number): boolean {
    const known = new Set(this.props.events.map((e) => e.key))
    const added = update.events.filter((e) => !known.has(e.key))
    const nextStatus = advanceStatus(this.props.status, update.status)
    const changed = added.length > 0 || nextStatus !== this.props.status

    if (added.length > 0) {
      this.props.events = [...this.props.events, ...added].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      )
    }
    this.props.status = nextStatus

    if (nextStatus === 'delivered' && !this.props.deliveredAt) {
      const delivery = [...this.props.events].reverse().find((e) => e.status === 'delivered')
      this.props.deliveredAt = delivery?.occurredAt ?? now
    }

    this.props.lastCheckedAt = now
    this.props.failureCount = 0
    this.props.nextCheckAt = this.isFinal ? now : new Date(now.getTime() + intervalMinutes * 60_000)
    this.props.updatedAt = now
    return changed
  }

  recordCheckFailure(now: Date, intervalMinutes: number): void {
    this.props.failureCount += 1
    const delayMinutes = Math.min(
      intervalMinutes * 2 ** Math.min(this.props.failureCount, 10),
      MAX_BACKOFF_MINUTES,
    )
    this.props.nextCheckAt = new Date(now.getTime() + delayMinutes * 60_000)
    this.props.updatedAt = now
  }
}
