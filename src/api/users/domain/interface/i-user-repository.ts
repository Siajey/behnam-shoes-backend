import { User } from '@api/users/domain'
import { ListQuery } from '@common/dto'

export const USER_FILTER_FIELDS = [
  'username',
  'email',
  'status',
  'role',
  'createdAt',
  'updatedAt',
] as const
export const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'username'] as const
export type UserFilterField = (typeof USER_FILTER_FIELDS)[number]

export interface ListUsersQuery extends ListQuery<UserFilterField> {
  username?: string
  email?: string
  role?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface IUserRepository {
  findAll(getItemsDto: ListUsersQuery): Promise<{
    users: User[]
    nextCursor?: string
  }>

  count(getItemsDto: ListUsersQuery): Promise<number>

  save(user: User): Promise<User>

  delete(userId: string): Promise<object>

  findById(userId: string): Promise<User>

  findByPhoneNumber(phoneNumber: string): Promise<User>

  update(id: string, user: Partial<User>): Promise<User>

  updateByPhoneNumber(phoneNumber: string, user: Partial<User>): Promise<User>

  findSessionState(userId: string): Promise<{
    status: string
    updatedAt: Date
    role: string
  }>

  findByIdWithProfile(id: string): Promise<User>
}
