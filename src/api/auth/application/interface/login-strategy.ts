import { User } from '@api/users/domain'

export default interface LoginStrategy {
  handleLogin: (credentials: any) => Promise<User>
}
