import {Address, Profile, User} from '@api/users/domain'

export interface ShippingInfo {
    address: {
        province: string
        city: string
        street: string
        postalCode: string
    }
    recipient: {
        firstName: string
        lastName: string
        phoneNumber: string
    }
}

export interface IUpdateMe {
    execute(userId: string, updateDto: Partial<Partial<Profile> & { address?: Address }>): Promise<Partial<Profile> & {
        address?: Address
    }>
}

export interface IGetMe {
    execute(userId: string): Promise<User>
}


export interface IGetShippingInfo {
    execute(userId: string, addressId: string): Promise<ShippingInfo>
}