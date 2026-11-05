import {
  ADDRESS_REPOSITORY,
  CREATE_ADDRESS,
  createProvider,
  DELETE_ADDRESS,
  GET_MY_ADDRESSES,
  SET_DEFAULT_ADDRESS,
  UPDATE_ADDRESS,
} from '@common/di'
import {
  CreateAddressUseCase,
  DeleteAddressUseCase,
  GetMyAddressesUseCase,
  SetDefaultAddressUseCase,
  UpdateAddressUseCase,
} from '@api/users/application'

export const AddressProviders = [
  createProvider<GetMyAddressesUseCase>(
    GET_MY_ADDRESSES,
    GetMyAddressesUseCase,
    [ADDRESS_REPOSITORY],
  ),
  createProvider<CreateAddressUseCase>(CREATE_ADDRESS, CreateAddressUseCase, [
    ADDRESS_REPOSITORY,
  ]),
  createProvider<UpdateAddressUseCase>(UPDATE_ADDRESS, UpdateAddressUseCase, [
    ADDRESS_REPOSITORY,
  ]),
  createProvider<SetDefaultAddressUseCase>(
    SET_DEFAULT_ADDRESS,
    SetDefaultAddressUseCase,
    [ADDRESS_REPOSITORY],
  ),
  createProvider<DeleteAddressUseCase>(DELETE_ADDRESS, DeleteAddressUseCase, [
    ADDRESS_REPOSITORY,
  ]),
]
