import { IVerifyUser } from '@api/auth/application'
import {
  getVerificationSecrets,
  ITokenService,
  SecretType,
} from '@common/security'
import { ConfigProvider } from '@common/configuration'
import { IUserRepository, UserStatus } from '@api/users/domain'
import { ILogger } from '@common/logger'
import { ValidationError } from '@common/errors'

export class VerifyUserUseCase implements IVerifyUser {
  constructor(
    private readonly jwtTokenService: ITokenService,
    private readonly userRepository: IUserRepository,
    private readonly configProvider: ConfigProvider,
    private readonly logger: ILogger,
  ) {}

  async execute(token: string): Promise<void> {
    const secrets = getVerificationSecrets(
      this.configProvider,
      SecretType.CONFIRM_EMAIL,
    )
    let payload
    try {
      payload = this.jwtTokenService.verifyAny(token, secrets)
    } catch {
      throw new ValidationError({
        message: 'errors.validation.invalidToken',
        code: 'INVALID_TOKEN',
      })
    }
    await this.userRepository.update(payload.identifier, {
      status: UserStatus.ACTIVE,
    })
    this.logger.info('User verified successfully.', {
      module: 'VerifyUserUseCase',
      event: 'auth.verifyUser',
      operation: 'verifyUser',
      userId: payload.identifier,
    })
  }
}
