import {Address, Profile, User} from '@api/users/domain'

export interface IUpdateMe {
    execute(userId: string, updateDto: Partial<Partial<Profile> & { address?: Address }>): Promise<Partial<Profile> & {
        address?: Address
    }>
}

export interface IGetMe {
    execute(userId: string): Promise<User>
}
