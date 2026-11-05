import {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from '@api/users/domain'
import { stripUndefined } from '@common/util'

import { AddressRow, NewAddressRow } from '../models/address.model'

export class AddressMapper {
  static toDomain(row: AddressRow): Address {
    return new Address({
      id: row.id,
      profileId: row.profileId,
      province: row.province,
      city: row.city,
      street: row.street,
      postalCode: row.postalCode,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  static toPersistence(
    profileId: string,
    input: CreateAddressInput,
    isDefault: boolean,
  ): NewAddressRow {
    return {
      profileId,
      province: input.province,
      city: input.city,
      street: input.street,
      postalCode: input.postalCode,
      isDefault,
    }
  }

  static toUpdate(input: UpdateAddressInput): Partial<NewAddressRow> {
    return stripUndefined({
      province: input.province,
      city: input.city,
      street: input.street,
      postalCode: input.postalCode,
    })
  }
}
