import { Inject, Injectable } from '@nestjs/common'
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'

import {
  Address,
  CreateAddressInput,
  IAddressRepository,
  MAX_ADDRESSES_PER_PROFILE,
  UpdateAddressInput,
} from '@api/users/domain'
import { ConflictError, NotFoundError } from '@common/errors'
import { DATABASE } from '@common/di'
import { Database } from '@common/db'

import { AddressMapper } from '../mappers'
import * as addressSchema from '../models/address.model'
import * as profileSchema from '../models/profile.model'

const { addresses } = addressSchema
const { profiles } = profileSchema

type Schema = typeof addressSchema & typeof profileSchema
type Transaction = Parameters<
  Parameters<Database<Schema>['transaction']>[0]
>[0]

@Injectable()
export class AddressRepository implements IAddressRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<Schema>) {}

  async findAllByUserId(userId: string): Promise<Address[]> {
    const rows = await this.db
      .select()
      .from(addresses)
      .where(this.ownedBy(userId))
      .orderBy(desc(addresses.isDefault), asc(addresses.createdAt))
    return rows.map(AddressMapper.toDomain)
  }

  async create(userId: string, input: CreateAddressInput): Promise<Address> {
    return this.db.transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId, true)

      const [{ total }] = await tx
        .select({ total: count() })
        .from(addresses)
        .where(eq(addresses.profileId, profileId))
      if (total >= MAX_ADDRESSES_PER_PROFILE)
        throw new ConflictError({
          message: 'errors.address.limitReached',
          code: 'ADDRESS_LIMIT_REACHED',
        })

      const isDefault = input.isDefault === true || total === 0
      if (isDefault) await this.clearDefault(tx, profileId)

      const [row] = await tx
        .insert(addresses)
        .values(AddressMapper.toPersistence(profileId, input, isDefault))
        .returning()
      return AddressMapper.toDomain(row)
    })
  }

  async update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<Address> {
    const [row] = await this.db
      .update(addresses)
      .set({ ...AddressMapper.toUpdate(input), updatedAt: new Date() })
      .where(and(eq(addresses.id, addressId), this.ownedBy(userId)))
      .returning()
    if (!row) throw this.notFound()
    return AddressMapper.toDomain(row)
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    return this.db.transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId)

      const [target] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(
          and(eq(addresses.id, addressId), eq(addresses.profileId, profileId)),
        )
      if (!target) throw this.notFound()

      await this.clearDefault(tx, profileId)
      const [row] = await tx
        .update(addresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(addresses.id, addressId))
        .returning()
      return AddressMapper.toDomain(row)
    })
  }

  async delete(userId: string, addressId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId)

      const [deleted] = await tx
        .delete(addresses)
        .where(
          and(eq(addresses.id, addressId), eq(addresses.profileId, profileId)),
        )
        .returning()
      if (!deleted) throw this.notFound()

      if (deleted.isDefault)
        await tx
          .update(addresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(
            inArray(
              addresses.id,
              tx
                .select({ id: addresses.id })
                .from(addresses)
                .where(eq(addresses.profileId, profileId))
                .orderBy(asc(addresses.createdAt))
                .limit(1),
            ),
          )
    })
  }

  private ownedBy(userId: string) {
    return inArray(
      addresses.profileId,
      this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, userId)),
    )
  }

  private async lockProfile(
    tx: Transaction,
    userId: string,
    createIfMissing = false,
  ): Promise<string> {
    if (createIfMissing)
      await tx
        .insert(profiles)
        .values({ userId })
        .onConflictDoNothing({ target: profiles.userId })

    const [profile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .for('update')
    if (!profile) throw this.notFound()
    return profile.id
  }

  private clearDefault(tx: Transaction, profileId: string) {
    return tx
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(eq(addresses.profileId, profileId), eq(addresses.isDefault, true)),
      )
  }

  private notFound() {
    return new NotFoundError({ message: 'errors.address.notFound' })
  }
}
