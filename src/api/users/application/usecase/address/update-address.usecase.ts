import { IUpdateAddress } from '@api/users/application'
import {
  Address,
  IAddressRepository,
  UpdateAddressInput,
} from '@api/users/domain'
import { ValidationError } from '@common/errors'
import { isUuid } from '@common/validations'

export class UpdateAddressUseCase implements IUpdateAddress {
  constructor(private readonly addressRepository: IAddressRepository) {}

  async execute(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<Address> {
    if (!isUuid(addressId))
      throw new ValidationError({ message: 'errors.validation.invalidUuid' })
    return this.addressRepository.update(userId, addressId, input)
  }
}
