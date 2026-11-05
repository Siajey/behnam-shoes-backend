import {ICSRFToken} from '@api/auth/application'
import {ISessionService} from '@api/session//application'
import {ConfigProvider} from '@common/configuration'
import {CookieModel} from '@common/api'

export class CsrfTokenUsecase implements ICSRFToken {
    constructor(
        private readonly sessionService: ISessionService,
        private readonly configProvider: ConfigProvider,
    ) {
    }

    execute() {
        const {csrfSecret, csrfToken} = this.sessionService.generateCsrfTokens(
            this.configProvider.get('CSRF_TOKEN_SECRET') || 'csrf',
        )
        const csrfSecretCookie = this.sessionService.generateCsrfCookie(
            this.configProvider.get('NODE_ENV') === 'production',
            csrfToken,
            csrfSecret,
        )
        return {
            cookie: csrfSecretCookie,
            csrfToken
        }
    }
}
