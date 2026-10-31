import { Module } from '@nestjs/common'

import { HASH_GENERATOR, JWT_TOKEN_SERVICE, PASSWORD_HASHER } from '@common/di'
import { BcryptPasswordHasher, CryptoHashGenerator, JwtTokenService } from './impl'

@Module({
  providers: [
    { provide: JWT_TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: HASH_GENERATOR, useClass: CryptoHashGenerator },
  ],
  exports: [JWT_TOKEN_SERVICE, PASSWORD_HASHER, HASH_GENERATOR],
})
export default class CryptoModule {}
