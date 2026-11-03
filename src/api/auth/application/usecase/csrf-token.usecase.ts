import { ICSRFToken } from '@api/auth/application'
import { ISessionService } from '@session//application'
import { ConfigProvider } from '@common/configuration'
import { CookieModel } from '@common/api'

export class CsrfTokenUsecase implements ICSRFToken {
  constructor(
    private readonly sessionService: ISessionService,
    private readonly configProvider: ConfigProvider,
  ) {}

  execute(): CookieModel[] {
    const { csrfSecret, csrfToken } = this.sessionService.generateCsrfTokens(
      this.configProvider.get('CSRF_TOKEN_SECRET') || 'csrf',
    )
    return this.sessionService.generateCsrfCookie(
      this.configProvider.get('NODE_ENV') === 'production',
      csrfToken,
      csrfSecret,
    )
  }
}
