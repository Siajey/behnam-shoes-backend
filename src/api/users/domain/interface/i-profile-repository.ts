import {Address, Profile, User} from '@api/users/domain'
import {ShippingInfo} from "@api/users/application";

export interface IProfileRepository {
    updateMe(id: string, user: Partial< Partial<Profile> & { address?: Address }>): Promise< Partial<Profile> & { address?: Address }>

    findById(userId: string): Promise<User>

    findByIdWithAddress(profileId: string): Promise<User>

    findShippingInfo(
        userId: string,
        addressId: string,
    ): Promise<ShippingInfo | null>

}
