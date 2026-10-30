import { Injectable } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'

import { ITokenService } from '@common/security'
import { ValidationError } from '@common/errors'

@Injectable()
export class JwtTokenService implements ITokenService {
  generate(
    identifier: string,
    secret: string,
    expiresIn: any = '1h',
    algorithm: jwt.Algorithm = 'HS256',
  ): string {
    return jwt.sign({ identifier: identifier }, secret, {
      algorithm: algorithm,
      expiresIn: `${expiresIn}`,
    })
  }

  verify(
    hash: string,
    secret: string,
    algorithm: jwt.Algorithm = 'HS256',
  ): jwt.JwtPayload {
    let payload: jwt.JwtPayload | string

    try {
      payload = jwt.verify(hash, secret, {
        algorithms: [algorithm],
      })
    } catch {
      this.invalidToken()
    }

    if (typeof payload === 'string') {
      this.invalidToken()
    }

    const { identifier, iat, exp } = payload

    if (!identifier || !iat || !exp) {
      this.invalidToken()
    }

    return { identifier, iat, exp }
  }

  verifyAny(
    hash: string,
    secrets: readonly string[],
    algorithm: jwt.Algorithm = 'HS256',
  ): jwt.JwtPayload {
    for (const secret of secrets) {
      try {
        return this.verify(hash, secret, algorithm)
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error
        }
      }
    }

    this.invalidToken()
  }

  private invalidToken(): never {
    throw new ValidationError({
      message: 'errors.validation.invalidToken',
      code: 'INVALID_TOKEN',
    })
  }
}
