import { Inject, Injectable } from '@nestjs/common'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { PgDatabase } from 'drizzle-orm/pg-core'

import {
     CreateAddressInput,
    IProfileRepository,
    Profile,
    User,
    UserRole,
    UserStatus,
} from '@api/users/domain'
import { NotFoundError } from '@common/errors'
import { DATABASE } from '@common/di'
import { Database } from '@common/db'
import { stripUndefined } from '@common/util'

import { AddressMapper, ProfileMapper } from '../mappers'
import {UserRow, users} from '../models/user.model'
import {ProfileRow, profiles} from '../models/profile.model'
import {addresses, AddressRow} from '../models/address.model'

const schema = { users, profiles, addresses }

type DbExecutor = PgDatabase<any, any, any>

const userNotFound = () =>
    new NotFoundError({ message: 'errors.user.notFound' })

const ADDRESS_ORDER = [desc(addresses.isDefault), asc(addresses.createdAt)] as const

@Injectable()
export class ProfileRepository implements IProfileRepository {
    constructor(
        @Inject(DATABASE) private readonly db: Database<typeof schema>,
    ) {}

    async findById(userId: string): Promise<User> {
        const [row] = await this.db
            .select({ user: users, profile: profiles })
            .from(users)
            .leftJoin(profiles, eq(profiles.userId, users.id))
            .where(eq(users.id, userId))
            .limit(1)

        if (!row) throw userNotFound()
        return this.toUser(row.user, row.profile)
    }

    async findByIdWithAddress(userId: string): Promise<User> {
        const rows = await this.db
            .select({ user: users, profile: profiles, address: addresses })
            .from(users)
            .leftJoin(profiles, eq(profiles.userId, users.id))
            .leftJoin(addresses, eq(addresses.profileId, profiles.id))
            .where(eq(users.id, userId))
            .orderBy(...ADDRESS_ORDER)

        if (!rows.length) throw userNotFound()

        const { user, profile } = rows[0]
        const addressRows = rows.flatMap((r) => (r.address ? [r.address] : []))
        return this.toUser(user, profile, addressRows)
    }

    async updateMe(
        userId: string,
        patch: Partial<Profile> & { address?: CreateAddressInput },
    ): Promise<Profile> {
        const { address, ...scalars } = patch

        if (!address) {
            const profile = await this.upsertProfile(this.db, userId, scalars)
            const addressRows = await this.findAddressRows(this.db, profile.id)
            return ProfileMapper.toDomain(profile, addressRows)
        }

        return this.db.transaction(async (tx) => {
            const profile = await this.upsertProfile(tx, userId, scalars)
            await this.upsertDefaultAddress(tx, profile.id, address)
            const addressRows = await this.findAddressRows(tx, profile.id)
            return ProfileMapper.toDomain(profile, addressRows)
        })
    }

    private async upsertProfile(
        db: DbExecutor,
        userId: string,
        scalars: Partial<Profile>,
    ): Promise<ProfileRow> {
        const values = stripUndefined(ProfileMapper.toPersistence(scalars))
        const [row] = await db
            .insert(profiles)
            .values({ ...values, userId })
            .onConflictDoUpdate({
                target: profiles.userId,
                set: { ...values, updatedAt: new Date() },
            })
            .returning()
        return row
    }

    private async upsertDefaultAddress(
        db: DbExecutor,
        profileId: string,
        input: CreateAddressInput,
    ): Promise<void> {
        const values = stripUndefined(AddressMapper.toPersistence(profileId,input,true))

        const target = db
            .select({ id: addresses.id })
            .from(addresses)
            .where(eq(addresses.profileId, profileId))
            .orderBy(...ADDRESS_ORDER)
            .limit(1)

        const updated = await db
            .update(addresses)
            .set({ ...values, updatedAt: new Date() })
            .where(inArray(addresses.id, target))
            .returning({ id: addresses.id })

        if (updated.length) return

        await db
            .insert(addresses)
            .values({ ...values, profileId, isDefault: true } as typeof addresses.$inferInsert)
    }

    private findAddressRows(db: DbExecutor, profileId: string): Promise<AddressRow[]> {
        return db
            .select()
            .from(addresses)
            .where(eq(addresses.profileId, profileId))
            .orderBy(...ADDRESS_ORDER)
    }

    private toUser(
        user: UserRow,
        profile: ProfileRow | null,
        addressRows?: AddressRow[],
    ): User {
        return new User({
            ...user,
            role: user.role as UserRole,
            status: user.status as UserStatus,
            profile: profile ? ProfileMapper.toDomain(profile, addressRows) : null,
        })
    }
}