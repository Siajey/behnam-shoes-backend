import { ShippingMethod } from '@api/shipping/domain'

export interface CreateShippingMethodCommand {
  code: string
  name: string
  description?: string | null
  carrier: string
  service: string
  isActive?: boolean
  position?: number
  fallbackFee?: number | null
  freeThreshold?: number | null
  handlingFee?: number
}

export interface EditShippingMethodCommand {
  id: string
  name?: string
  description?: string | null
  carrier?: string
  service?: string
  isActive?: boolean
  position?: number
  fallbackFee?: number | null
  freeThreshold?: number | null
  handlingFee?: number
}

export interface IListShippingMethods {
  execute(): Promise<ShippingMethod[]>
}
export interface IGetShippingMethod {
  execute(id: string): Promise<ShippingMethod>
}
export interface ICreateShippingMethod {
  execute(command: CreateShippingMethodCommand, actorId: string): Promise<ShippingMethod>
}
export interface IEditShippingMethod {
  execute(command: EditShippingMethodCommand, actorId: string): Promise<ShippingMethod>
}
export interface IDeleteShippingMethod {
  execute(id: string, actorId: string): Promise<void>
}
