import { IDeleteAddress } from '@api/users/application'
import { IAddressRepository } from '@api/users/domain'
import { ValidationError } from '@common/errors'
import { isUuid } from '@common/validations'

export class DeleteAddressUseCase implements IDeleteAddress {
  constructor(private readonly addressRepository: IAddressRepository) {}

  async execute(userId: string, addressId: string): Promise<void> {
    if (!isUuid(addressId))
      throw new ValidationError({ message: 'errors.validation.invalidUuid' })
    return this.addressRepository.delete(userId, addressId)
  }
}
