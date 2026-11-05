import {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from '@api/users/domain'

export interface IGetMyAddresses {
  execute(userId: string): Promise<Address[]>
}

export interface ICreateAddress {
  execute(userId: string, input: CreateAddressInput): Promise<Address>
}

export interface IUpdateAddress {
  execute(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<Address>
}

export interface ISetDefaultAddress {
  execute(userId: string, addressId: string): Promise<Address>
}

export interface IDeleteAddress {
  execute(userId: string, addressId: string): Promise<void>
}
