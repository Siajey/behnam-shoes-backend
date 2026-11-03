import { IResetPassword } from '@api/auth/application'
import { ValidationError } from '@common/errors'
import { IHashGenerator, IPasswordHasher } from '@common/security'
import { ILogger } from '@common/logger'
import { IUserRepository } from '@api/users/domain'

export class ResetPasswordUseCase implements IResetPassword {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashGenerator: IHashGenerator,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  async execute(resetBody: {
    resetToken: string
    newPassword: string
    confirmPassword: string
  }): Promise<void> {
    if (resetBody.newPassword !== resetBody.confirmPassword) {
      throw new ValidationError({
        message: 'errors.validation.password.passwordsNotMatch',
      })
    }

    const hashedResetToken = this.hashGenerator.hash(resetBody.resetToken)
    const user =
      await this.userRepository.findForResetPassword(hashedResetToken)

    if (
      !user ||
      !user.passwordTokenExpires ||
      user.passwordTokenExpires < new Date()
    ) {
      throw new ValidationError({
        message: 'errors.validation.invalidResetToken',
        code: 'Invalid_Reset_Token',
      })
    }
    const hashedPassword = await this.passwordHasher.hash(
      resetBody.newPassword,
      10,
    )
    await this.userRepository.update(user.id, {
      passwordHash: hashedPassword,
      passwordChangedAt: new Date(),
      passwordResetToken: null,
      passwordTokenExpires: null,
    })

    this.logger.info('Password is reset successfully.', {
      module: 'ResetPasswordUseCase',
      event: 'auth.resetPassword',
      operation: 'resetPassword',
      userId: user.id,
    })
  }
}
