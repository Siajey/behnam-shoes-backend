import { ShippingMethod } from '../entities'

export interface IShippingMethodRepository {
  findById(id: string): Promise<ShippingMethod | null>
  findByCode(code: string): Promise<ShippingMethod | null>
  codeExists(code: string): Promise<boolean>
  findAll(): Promise<ShippingMethod[]>
  findActive(): Promise<ShippingMethod[]>
  save(method: ShippingMethod): Promise<void>
  delete(id: string): Promise<void>
}
