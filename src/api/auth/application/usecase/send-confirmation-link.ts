import { ISendConfirmationLink } from '@api/auth/application'
import { ForbiddenError, NotFoundError } from '@common/errors'
import { ITokenService } from '@common/security'
import { ConfigProvider } from '@common/configuration'
import { EmailService } from '@common/sender'
import { sendConfirmationLinkHelper } from '../util'
import { IUserRepository, User, UserStatus } from '@api/users/domain'
import { ILogger } from '@common/logger'

export class SendConfirmationLink implements ISendConfirmationLink {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly emailService: EmailService,
    private readonly configProvider: ConfigProvider,
    private readonly logger: ILogger,
  ) {}

  async execute(email: string) {
    const user = await this.userRepository.findByEmail(email)

    if (!user) {
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new ForbiddenError({
        message: 'errors.user.userAlreadyConfirmed',
      })
    } else {
      const token = this.tokenService.generate(
        user.id,
        this.configProvider.get('CONFIRM_EMAIL_SECRET_CURRENT'),
        '10m',
      )
      await sendConfirmationLinkHelper(
        user as User,
        token.toString(),
        this.configProvider,
        this.emailService,
      )
      this.logger.info('Confirmation email sent successfully.', {
        module: 'SendConfirmationLink',
        event: 'auth.sendConfirmationLink',
        operation: 'sendConfirmationLink',
        userId: user.id,
      })
    }
  }
}
