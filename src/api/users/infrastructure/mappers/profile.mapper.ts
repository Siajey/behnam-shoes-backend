import { Address, NewAddress, Profile, ProfileUpdate } from '@api/users/domain'
import { ProfileRow } from '../models/profile.model'
import { AddressRow, NewAddressRow } from '../models/address.model'

export class AddressMapper {
    static toDomain(row: AddressRow): Address {
        return {
            id: row.id,
            profileId: row.profileId,
            recipientName: row.recipientName,
            recipientPhone: row.recipientPhone,
            province: row.province,
            city: row.city,
            postalCode: row.postalCode,
            addressLine: row.addressLine,
            isDefault: row.isDefault,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }
    }

    static toPersistence(address: NewAddress, profileId: string): NewAddressRow {
        return {
            id: address.id,
            profileId,
            recipientName: address.recipientName,
            recipientPhone: address.recipientPhone,
            province: address.province,
            city: address.city,
            postalCode: address.postalCode,
            addressLine: address.addressLine,
            isDefault: address.isDefault ?? false,
        }
    }
}

export class ProfileMapper {
    static toDomain(row: ProfileRow, addresses: AddressRow[] = []): Profile {
        return new Profile({
            id: row.id,
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            addresses: addresses.map(AddressMapper.toDomain),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt ?? undefined,
        })
    }

    static toPersistence(profile: ProfileUpdate, userId: string) {
        return {
            userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
        }
    }
}
