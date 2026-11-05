import { ListUsersQuery, User } from '@api/users/domain'

export interface ICreateUser {
  execute(user: User): Promise<User>
}

export interface IGetUserById {
  execute(userId: string): Promise<User>
}

export interface IUpdateUser {
  execute(updateDTO: Partial<User>): Promise<User>
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
