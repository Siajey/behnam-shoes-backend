import { randomUUID } from 'node:crypto'

import { InvalidShippingMethodError } from '../errors'

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,29}$/

const isInteger = (n: number, min: number): boolean => Number.isInteger(n) && n >= min

export interface ShippingMethodInput {
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

export interface ShippingMethodProps extends ShippingMethodInput {
  id: string
  code: string
  createdAt: Date
  updatedAt: Date
}

export class ShippingMethod {
  private constructor(private props: ShippingMethodProps) {}

  static create(
    input: Pick<ShippingMethodInput, 'name' | 'carrier' | 'service'> &
      Partial<ShippingMethodInput> & { code: string },
  ): ShippingMethod {
    const code = input.code.trim()
    if (!CODE_PATTERN.test(code)) throw new InvalidShippingMethodError('code')

    const now = new Date()
    const data = ShippingMethod.validated({
      name: input.name,
      description: input.description ?? null,
      carrier: input.carrier,
      service: input.service,
      isActive: input.isActive ?? true,
      position: input.position ?? 0,
      fallbackFee: input.fallbackFee ?? null,
      freeThreshold: input.freeThreshold ?? null,
      handlingFee: input.handlingFee ?? 0,
    })
    return new ShippingMethod({ id: randomUUID(), code, ...data, createdAt: now, updatedAt: now })
  }

  static restore(props: ShippingMethodProps): ShippingMethod {
    return new ShippingMethod(props)
  }

  private static validated(d: ShippingMethodInput): ShippingMethodInput {
    const name = d.name.trim()
    const description = d.description?.trim() || null
    const carrier = d.carrier.trim()
    const service = d.service.trim()

    if (name.length < 1 || name.length > 60) throw new InvalidShippingMethodError('name')
    if (description !== null && description.length > 200) throw new InvalidShippingMethodError('description')
    if (!CODE_PATTERN.test(carrier)) throw new InvalidShippingMethodError('carrier')
    if (service.length < 1 || service.length > 50) throw new InvalidShippingMethodError('service')
    if (!isInteger(d.position, 0)) throw new InvalidShippingMethodError('position')
    if (d.fallbackFee !== null && !isInteger(d.fallbackFee, 0)) throw new InvalidShippingMethodError('fallbackFee')
    if (d.freeThreshold !== null && !isInteger(d.freeThreshold, 1)) throw new InvalidShippingMethodError('freeThreshold')
    if (!isInteger(d.handlingFee, 0)) throw new InvalidShippingMethodError('handlingFee')

    return { ...d, name, description, carrier, service }
  }

  get id() { return this.props.id }
  get code() { return this.props.code }
  get name() { return this.props.name }
  get description() { return this.props.description }
  get carrier() { return this.props.carrier }
  get service() { return this.props.service }
  get isActive() { return this.props.isActive }
  get position() { return this.props.position }
  get fallbackFee() { return this.props.fallbackFee }
  get freeThreshold() { return this.props.freeThreshold }
  get handlingFee() { return this.props.handlingFee }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  update(changes: Partial<ShippingMethodInput>): void {
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, v]) => v !== undefined),
    ) as Partial<ShippingMethodInput>

    const data = ShippingMethod.validated({
      name: this.props.name,
      description: this.props.description,
      carrier: this.props.carrier,
      service: this.props.service,
      isActive: this.props.isActive,
      position: this.props.position,
      fallbackFee: this.props.fallbackFee,
      freeThreshold: this.props.freeThreshold,
      handlingFee: this.props.handlingFee,
      ...defined,
    })
    Object.assign(this.props, data, { updatedAt: new Date() })
  }
}
