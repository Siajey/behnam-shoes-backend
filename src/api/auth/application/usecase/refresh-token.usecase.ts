import { IRefreshToken } from '@api/auth/application'
import { ConfigProvider } from '@common/configuration'
import {
  getVerificationSecrets,
  ITokenService,
  SecretType,
} from '@common/security'
import { CookieModel } from '@common/api'
import { ISessionService } from '@api/session/application'
import { UnAuthorizedError } from '@common/errors'

export class RefreshTokenUsecase implements IRefreshToken {
  constructor(
    private readonly tokenService: ITokenService,
    private readonly sessionService: ISessionService,
    private readonly configProvider: ConfigProvider,
  ) {}

  async execute(
    refreshToken: string,
  ): Promise<{ accessCookie: CookieModel; refreshCookie: CookieModel }> {
    let identifier: string
    const secrets = getVerificationSecrets(
      this.configProvider,
      SecretType.REFRESH_TOKEN,
    )
    try {
      const payload = this.tokenService.verifyAny(refreshToken, secrets)
      identifier = payload.identifier
    } catch {
      throw new UnAuthorizedError({
        code: 'InvalidRefreshToken',
        message: 'errors.sessions.invalidRefreshToken',
      })
    }
    const { newRefreshToken, accessToken } =
      await this.sessionService.generateAuthTokens(identifier)
    return this.sessionService.generateAuthCookies(
      this.configProvider.get('NODE_ENV') === 'production',
      accessToken.toString(),
      newRefreshToken.toString(),
    )
  }
}
