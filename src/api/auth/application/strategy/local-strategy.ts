import { LoginStrategy } from '@api/auth/application'
import { LocalLoginSchemaType } from '@api/auth/presentation'
import { IUserRepository, User, UserStatus } from '@api/users/domain'
import { NotFoundError, ValidationError } from '@common/errors'
import { IPasswordHasher } from '@common/security'
import { ForbiddenException } from '@nestjs/common'
import { ILogger } from '@common/logger'

export default class LocalStrategy implements LoginStrategy {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  async handleLogin(loginBody: LocalLoginSchemaType): Promise<User> {
    const user = await this.userRepository.findForLogin(
      loginBody.emailOrUsername,
    )
    if (!user) {
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    }
    if (user.status === UserStatus.REGISTERED) {
      throw new ForbiddenException('errors.auth.userNotVerified')
    }
    if (!user.passwordHash) {
      throw new ValidationError({
        message: 'common.cta.loginByOtp',
        code: 'INVALID_CREDENTIALS',
      })
    }
    const validPassword = await this.passwordHasher.compare(
      loginBody.password,
      user.passwordHash,
    )
    if (!validPassword) {
      throw new ValidationError({
        message: 'errors.validation.invalidCredentials',
        code: 'INVALID_CREDENTIALS',
      })
    }

    this.logger.info('User is logged in successfully.', {
      module: 'LocalStrategy',
      event: 'auth.localLogin',
      operation: 'login',
      userId: user.id,
    })
    await this.userRepository.update(user.id, {
      status: UserStatus.ACTIVE,
    })
    return {
      ...user,
      status: UserStatus.ACTIVE,
    } as User
  }
}
