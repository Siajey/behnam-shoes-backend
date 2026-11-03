import { CookieModel } from '@common/api'

export interface ISessionService {
  generateAuthSession(identifier: string): Promise<{
      cookies: CookieModel[],
      csrfToken: string
  }>

  generateAuthCookies(
    isProduction: boolean,
    accessToken: string,
    refreshToken: string,
  ): {
    accessCookie: CookieModel
    refreshCookie: CookieModel
  }

  generateAuthTokens(identifier: string): Promise<{
    accessToken: string | number
    newRefreshToken: string | number
  }>

  generateAuthToken(expiresIn: string, identifier: string, secret: string): any

  generateCsrfTokens(secret: string): {
    csrfSecret: string
    csrfToken: string
  }

  generateCsrfCookie(
    isProd: boolean,
    csrfToken: string,
    csrfSecret: string,
  ): CookieModel[]

  clearCookies(): CookieModel[]
}
