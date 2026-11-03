import { IForgotPassword } from '@api/auth/application'
import { IHashGenerator } from '@common/security'
import { ConfigProvider } from '@common/configuration'
import { EmailService } from '@common/sender'
import { NotFoundError } from '@common/errors'
import { resolveAssetPath } from '@common/util'
import { ILogger } from '@common/logger'
import { IUserRepository, User } from '@api/users/domain'

export class ForgotPasswordUsecase implements IForgotPassword {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashGenerator: IHashGenerator,
    private readonly configProvider: ConfigProvider,
    private readonly emailService: EmailService,
    private readonly logger: ILogger,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findContactByEmail(email)
    if (!user) {
      throw new NotFoundError({
        message: 'errors.user.notFound',
        code: 'USER_NOT_FOUND',
      })
    }

    const token = this.hashGenerator.generateSecret(32)
    const hashedToken = this.hashGenerator.hash(token)

    await this.userRepository.update(user.id, {
      passwordResetToken: hashedToken,
      passwordChangedAt: new Date(),
      passwordTokenExpires: new Date(Date.now() + 10 * 60 * 1000),
    })

    const resetLink = `${this.configProvider.get('FRONT_END_RESET_PASSWORD_ENDPOINT')}/${token}`
    await this.emailService.send(
      'Reset Password',
      [user as User],
      resolveAssetPath('email', 'reset-password-email-template.html'),
      {
        User_Name: user.email,
        Reset_Link: resetLink,
        Company_Name: this.configProvider.get('COMPANY_NAME'),
        Company_Email_Address: this.configProvider.get('COMPANY_EMAIL'),
      },
    )

    this.logger.info('Password reset link has been sent to email.', {
      module: 'ForgotPasswordUsecase',
      event: 'auth.forgotPassword',
      operation: 'forgotPassword',
      userId: user.id,
      data: {
        email: user.email,
      },
    })
  }
}
