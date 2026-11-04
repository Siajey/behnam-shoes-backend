import {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from '@api/users/domain'

export interface IAddressRepository {
  findAllByUserId(userId: string): Promise<Address[]>

  create(userId: string, input: CreateAddressInput): Promise<Address>

  update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<Address>

  setDefault(userId: string, addressId: string): Promise<Address>

  delete(userId: string, addressId: string): Promise<void>
}
