import * as jwt from 'jsonwebtoken'

export interface ITokenService {
  generate(
    identifier: string,
    secret: string,
    expiresIn: any,
    algorithm?: string,
  ): string

  verify(hash: string, secret: string, algorithm?: string): any

  verifyAny(
    hash: string,
    secrets: readonly string[],
    algorithm?: jwt.Algorithm,
  ): any
}
