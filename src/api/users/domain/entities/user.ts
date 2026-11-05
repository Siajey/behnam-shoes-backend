import { Profile } from './profile'
import { UserStatus } from './user-status'
import { UserRole } from './user-role'

export class User {
  id: string
  phoneNumber: string
  role: UserRole
  status: UserStatus
  createdAt: Date
  updatedAt?: Date
  profile?: Profile

  constructor(obj: User) {
    Object.assign(this, obj)
  }
}

