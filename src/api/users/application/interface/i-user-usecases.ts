import { ListUsersQuery, User, UserResponse } from '@api/users/domain'

export interface ICreateUser {
  execute(user: User): Promise<UserResponse>
}

export interface IGetUserById {
  execute(userId: string): Promise<UserResponse>
}

export interface IUpdateUser {
  execute(updateDTO: Partial<User>): Promise<UserResponse>
}

export interface IGetUsers {
  execute(getItems: ListUsersQuery): Promise<{
    users: User[]
    length: number
    nextCursor?: string
  }>
}

export interface ICountUsers {
  execute(getItems: ListUsersQuery): Promise<number>
}

export interface IDeleteUser {
  execute(id: string): Promise<object>
}

export interface IDeleteMe {
  execute(userId: string): Promise<object>
}
