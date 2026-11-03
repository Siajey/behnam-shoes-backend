import { ChangePasswordBody, IChangePassword } from '@api/auth/application'
import { ValidationError } from '@common/errors'
import { IPasswordHasher } from '@common/security'
import { SessionCacheService } from '@session/application'
import { ILogger } from '@common/logger'
import { IUserRepository } from '@api/users/domain'

export class ChangePassword implements IChangePassword {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly cacheSession: SessionCacheService,
    private readonly logger: ILogger,
  ) {}

  async execute(changePasswordBody: ChangePasswordBody): Promise<void> {
    if (changePasswordBody.newPassword !== changePasswordBody.confirmPassword) {
      throw new ValidationError({
        message: 'errors.validation.password.passwordsNotMatch',
      })
    }
    if (changePasswordBody.newPassword === changePasswordBody.currentPassword) {
      throw new ValidationError({
        message: 'errors.validation.password.newPasswordNotMatch',
      })
    }
    const user = await this.userRepository.findForChangePassword(
      changePasswordBody.userId,
    )
    const passwordMatch = await this.passwordHasher.compare(
      changePasswordBody.currentPassword,
      user.passwordHash,
    )
    if (!user || !passwordMatch) {
      throw new ValidationError({
        message: 'errors.validation.password.currentPasswordNotMatch',
        code: 'CURRENT_PASSWORD_NOT_MATCH',
      })
    }
    const hashedPassword = await this.passwordHasher.hash(
      changePasswordBody.newPassword,
      10,
    )
    await this.userRepository.update(changePasswordBody.userId, {
      passwordHash: hashedPassword,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })

    await this.cacheSession.invalidateUserSession(changePasswordBody.userId)

    this.logger.info('Password is changed successfully.', {
      module: 'ChangePassword',
      event: 'auth.changePassword',
      operation: 'changePassword',
      userId: user.id,
    })
  }
}
