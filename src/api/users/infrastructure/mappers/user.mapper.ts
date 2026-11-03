import { UserRow } from '@api/users/infrastructure'
import { User, UserRole, UserStatus } from '@api/users/domain'

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

  static toPersistence(user: User): UserRow {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
