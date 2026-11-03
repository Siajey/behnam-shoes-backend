import { User, UserResponse } from '@api/users/domain'
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

  save(user: User): Promise<UserResponse>

  delete(userId: string): Promise<object>

  findById(userId: string): Promise<UserResponse>

  findByEmail(email: string): Promise<UserResponse>

  findContactByEmail(email: string): Promise<{ id: string; email: string }>

  findForLogin(emailOrUsername: string): Promise<{
    id: string
    passwordHash: string
    status: string
    role: string
    updatedAt: Date
    passwordChangedAt: Date
  }>

  findForChangePassword(id: string): Promise<{
    id: string
    passwordHash: string
  }>

  findForResetPassword(token: string): Promise<{
    id: string
    email: string
    passwordTokenExpires: Date
    passwordResetToken: string
  }>

  update(id: string, user: Partial<User>): Promise<UserResponse>

  findSessionState(userId: string): Promise<{
    status: string
    updatedAt: Date
    role: string
  }>

  findByIdWithProfile(id: string): Promise<UserResponse>
}
