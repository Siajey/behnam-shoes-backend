import {Address, Profile, User} from '@api/users/domain'

export interface IProfileRepository {
    updateMe(id: string, user: Partial< Partial<Profile> & { address?: Address }>): Promise< Partial<Profile> & { address?: Address }>

    findById(userId: string): Promise<User>

    findByIdWithAddress(profileId: string): Promise<User>
}
