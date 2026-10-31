import { Injectable } from '@nestjs/common'
import { BinaryToTextEncoding, createHash, createHmac, randomBytes } from 'crypto'

import { IHashGenerator } from '@common/security'

@Injectable()
export class CryptoHashGenerator implements IHashGenerator {
  generateSecret(size: number = 32, encoding: BufferEncoding = 'hex'): string {
    return randomBytes(size).toString(encoding)
  }

  hash(input: string, encoding: BinaryToTextEncoding = 'hex'): string {
    return createHash('sha256').update(input).digest(encoding)
  }

  hashMac(input: string, secret: string, encoding: BinaryToTextEncoding = 'hex'): string {
    return createHmac('sha256', secret).update(input).digest(encoding)
  }
}
