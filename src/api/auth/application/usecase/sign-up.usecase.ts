import { ISignUp, SignUpBody } from '@api/auth/application'
import { ValidationError } from '@common/errors'
import { IUserRepository, User, UserRole, UserStatus } from '@api/users/domain'
import { EmailService } from '@common/sender'
import { ConfigProvider } from '@common/configuration'
import { IPasswordHasher, ITokenService } from '@common/security'
import { sendConfirmationLinkHelper } from '../util'
import { ILogger } from '@common/logger'

export class SignUpUseCase implements ISignUp {
  constructor(
    private readonly tokenService: ITokenService,
    private readonly configService: ConfigProvider,
    private readonly passwordHasher: IPasswordHasher,
    private readonly emailService: EmailService,
    private readonly userRepository: IUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(signUp: SignUpBody): Promise<string> {
    if (signUp.password !== signUp.confirmPassword) {
      throw new ValidationError({
        message: 'errors.validation.password.passwordsNotMatch',
      })
    }
    const hashedPassword = await this.passwordHasher.hash(signUp.password, 10)
    const user: Partial<User> = {
      email: signUp.email,
      username: signUp.username,
      passwordHash: hashedPassword,
      status: UserStatus.REGISTERED,
      role: UserRole.USER,
      createdAt: new Date(),
    }
    const savedUser = await this.userRepository.save(user as User)
    const token = this.tokenService.generate(
      savedUser.id,
      this.configService.get('CONFIRM_EMAIL_SECRET_CURRENT'),
      '10m',
    )
    await sendConfirmationLinkHelper(
      savedUser as User,
      token.toString(),
      this.configService,
      this.emailService,
    )
    this.logger.info('User registered successfully.', {
      module: 'SignUpUseCase',
      event: 'auth.signup',
      operation: 'signup',
      userId: savedUser.id,
    })
    return signUp.email
  }
}
