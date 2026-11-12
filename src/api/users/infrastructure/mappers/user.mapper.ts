import {UserRow} from '@api/users/infrastructure'
import {Profile, User, UserRole, UserStatus} from '@api/users/domain'

export class UserMapper {
    static toDomain(row: UserRow): User {
        return new User({
            id: row.id,
            phoneNumber: row.phoneNumber,
            role: row.role as UserRole,
            status: row.status as UserStatus,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    static toDomainWithProfile(row: UserRow, profile:Profile): User {
        return new User({
            id: row.id,
            phoneNumber: row.phoneNumber,
            role: row.role as UserRole,
            status: row.status as UserStatus,
            profile: profile,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    static toPersistence(user: User): UserRow {
        return {
            id: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt ?? new Date(),
        }
    }
}
