import {
  COUNT_USERS,
  CREATE_USER,
  createProvider,
  DELETE_ME,
  DELETE_USER,
  FILE_SERVICE,
  GET_USER_BY_ID,
  GET_USERS,
  SESSION_CACHE_SERVICE,
  UPDATE_USER,
  USER_REPOSITORY,
} from '@common/di'
import {
  CountUsersUsecase,
  CreateUserUseCase,
  DeleteMeUseCase,
  DeleteUserUseCase,
  GetUserByIdUsecase,
  GetUsers,
  UpdateUserUseCase,
} from '@api/users/application'

export const UserUseCaseProviders = [
  createProvider<CreateUserUseCase>(CREATE_USER, CreateUserUseCase, [
    USER_REPOSITORY,
  ]),
  createProvider<GetUserByIdUsecase>(GET_USER_BY_ID, GetUserByIdUsecase, [
    USER_REPOSITORY,
  ]),
  createProvider<GetUsers>(GET_USERS, GetUsers, [USER_REPOSITORY]),
  createProvider<CountUsersUsecase>(COUNT_USERS, CountUsersUsecase, [
    USER_REPOSITORY,
  ]),
  createProvider<UpdateUserUseCase>(UPDATE_USER, UpdateUserUseCase, [
    USER_REPOSITORY,
  ]),
  createProvider<DeleteUserUseCase>(DELETE_USER, DeleteUserUseCase, [
    USER_REPOSITORY,
    SESSION_CACHE_SERVICE,
    FILE_SERVICE,
  ]),
  createProvider<DeleteMeUseCase>(DELETE_ME, DeleteMeUseCase, [DELETE_USER]),
]
