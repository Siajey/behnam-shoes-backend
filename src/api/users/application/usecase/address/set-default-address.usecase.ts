import { ISetDefaultAddress } from '@api/users/application'
import { Address, IAddressRepository } from '@api/users/domain'
import { ValidationError } from '@common/errors'
import { isUuid } from '@common/validations'

export class SetDefaultAddressUseCase implements ISetDefaultAddress {
  constructor(private readonly addressRepository: IAddressRepository) {}

  async execute(userId: string, addressId: string): Promise<Address> {
    if (!isUuid(addressId))
      throw new ValidationError({ message: 'errors.validation.invalidUuid' })
    return this.addressRepository.setDefault(userId, addressId)
  }
}
