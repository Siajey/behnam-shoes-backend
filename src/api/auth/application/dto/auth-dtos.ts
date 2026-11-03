import { UserRole, UserStatus } from '@api/users/domain'

export interface ChangePasswordBody {
  userId: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface RefreshTokenBody {
  refreshToken: string
  accessToken: string
}

export interface SignUpBody {
  email: string
  username: string
  password: string
  confirmPassword: string | undefined
  role?: UserRole
  status?: UserStatus
}

export interface LoginBody {
  emailOrUsername: string
  password: string
}
