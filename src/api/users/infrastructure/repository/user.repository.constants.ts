import * as userSchema from '../models/user.model'
import * as profileSchema from '../models/profile.model'

export const USER_SELECT = {
  id: userSchema.users.id,
  phoneNumber: userSchema.users.phoneNumber,
  status: userSchema.users.status,
  role: userSchema.users.role,
  updatedAt: userSchema.users.updatedAt,
  createdAt: userSchema.users.createdAt,
}

export const PROFILE_SELECT = {
    id: profileSchema.profiles.id,
    userId: profileSchema.profiles.userId,
    firstName: profileSchema.profiles.firstName,
    lastName: profileSchema.profiles.lastName,
    createdAt: profileSchema.profiles.createdAt,
    updatedAt: profileSchema.profiles.updatedAt,
}
