export const MAX_ADDRESSES_PER_PROFILE = 2

export class Address {
    id: string
    profileId: string
    province: string
    city: string
    street: string
    postalCode: string
    isDefault: boolean
    createdAt: Date
    updatedAt?: Date

    constructor(address: Address) {
        Object.assign(this, address)
    }
}

export interface CreateAddressInput {
    province: string
    city: string
    street: string
    postalCode: string
    isDefault?: boolean
}

export type UpdateAddressInput = Partial<Omit<CreateAddressInput, 'isDefault'>>