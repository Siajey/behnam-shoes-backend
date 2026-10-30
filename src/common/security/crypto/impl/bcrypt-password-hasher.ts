import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'

import { IPasswordHasher } from '@common/security'

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  hash(plain: string, saltRounds = 10): Promise<string> {
    return bcrypt.hash(plain, saltRounds)
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed)
  }
}
