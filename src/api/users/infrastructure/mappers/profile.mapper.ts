import {NewProfile, ProfileRow} from '../models/profile.model'
import {Profile} from '@api/users/domain'
import {AddressMapper} from "./address.mapper";
import { AddressRow } from "../models";

export class ProfileMapper {
    static toDomain(row: ProfileRow, addressRows?: AddressRow[]): Profile {
        return {
            id: row.id,
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            addresses: addressRows?.map(AddressMapper.toDomain),
        }
    }

    static toPersistence(profile: Partial<Profile>): NewProfile {
        return {
            userId: profile.userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
        }
    }
}
