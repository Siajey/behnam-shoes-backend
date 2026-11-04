import { IGetMyAddresses } from '@api/users/application'
import { Address, IAddressRepository } from '@api/users/domain'

export class GetMyAddressesUseCase implements IGetMyAddresses {
  constructor(private readonly addressRepository: IAddressRepository) {}

  execute(userId: string): Promise<Address[]> {
    return this.addressRepository.findAllByUserId(userId)
  }
}
