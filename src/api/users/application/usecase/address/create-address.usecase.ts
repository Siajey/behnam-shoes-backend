import { ICreateAddress } from '@api/users/application'
import {
  Address,
  CreateAddressInput,
  IAddressRepository,
} from '@api/users/domain'

export class CreateAddressUseCase implements ICreateAddress {
  constructor(private readonly addressRepository: IAddressRepository) {}
  execute(userId: string, input: CreateAddressInput): Promise<Address> {
    return this.addressRepository.create(userId, input)
  }
}
