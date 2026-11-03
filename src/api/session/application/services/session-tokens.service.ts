import {CookieModel} from '@common/api'
import {IHashGenerator, ITokenService} from '@common/security'
import {ConfigProvider} from '@common/configuration'
import {ISessionService} from '@api/session/application'

export class SessionTokensService implements ISessionService {
    constructor(
        private readonly tokenService: ITokenService,
        private readonly configService: ConfigProvider,
        private readonly hashGenerator: IHashGenerator,
    ) {
    }

    async generateAuthSession(identifier: string): Promise<{
        cookies: CookieModel[],
        csrfToken: string
    }> {
        const {accessToken, newRefreshToken} =
            await this.generateAuthTokens(identifier)
        const isProd = this.configService.get('NODE_ENV') === 'production'
        const authCookies = this.generateAuthCookies(
            isProd,
            accessToken.toString(),
            newRefreshToken.toString(),
        )
        const {csrfSecret, csrfToken} = this.generateCsrfTokens(
            this.configService.get('CSRF_TOKEN_SECRET'),
        )
        const csrfCookie = this.generateCsrfCookie(isProd, csrfSecret)
        return {
            cookies: [authCookies.accessCookie, authCookies.refreshCookie, ...csrfCookie],
            csrfToken: csrfToken
        }
    }

    clearCookies(): CookieModel[] {
        const createEmptyCookie = (key: string): CookieModel => ({
            key,
            value: '',
            path: '/',
        })
        const authCookieKeys = [
            'access_token',
            'refresh_token',
            'csrf_token',
            'csrf_secret',
        ]
        return authCookieKeys.map((key) => createEmptyCookie(key))
    }

    generateAuthCookies(
        isProduction: boolean,
        accessToken: string,
        refreshToken: string,
    ): {
        accessCookie: CookieModel
        refreshCookie: CookieModel
    } {
        return {
            accessCookie: {
                key: 'access_token',
                value: accessToken,
                path: '/',
                httpOnly: true,
                maxAge: 3600,
                sameSite: 'lax',
                secure: isProduction,
            },
            refreshCookie: {
                key: 'refresh_token',
                value: refreshToken,
                path: '/',
                httpOnly: true,
                maxAge: 3600 * 24 * 7,
                sameSite: 'lax',
                secure: isProduction,
            },
        }
    }

    async generateAuthTokens(identifier: string): Promise<{
        accessToken: string | number
        newRefreshToken: string | number
    }> {
        const [accessToken, refreshToken] = await Promise.all([
            this.generateAuthToken(
                '1h',
                identifier,
                this.configService.get('ACCESS_TOKEN_SECRET_CURRENT'),
            ),
            this.generateAuthToken(
                '7d',
                identifier,
                this.configService.get('REFRESH_TOKEN_SECRET_CURRENT'),
            ),
        ])

        return {accessToken, newRefreshToken: refreshToken}
    }

    generateAuthToken(expiresIn: string, identifier: string, secret: string) {
        return this.tokenService.generate(identifier, secret, expiresIn, 'HS256')
    }

    generateCsrfTokens(secret: string): {
        csrfSecret: string
        csrfToken: string
    } {
        const randomToken = this.hashGenerator.generateSecret()
        const csrfToken = this.hashGenerator.hashMac(randomToken, secret)
        return {csrfSecret: randomToken, csrfToken}
    }

    generateCsrfCookie(
        isProd: boolean,
        csrfSecret: string,
    ): CookieModel[] {
        return [
            {
                key: 'csrf_secret',
                value: csrfSecret,
                httpOnly: true,
                secure: isProd,
                sameSite: 'strict',
                path: '/',
                maxAge: 3600,
            }
        ]
    }
}
