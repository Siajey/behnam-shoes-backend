export interface IPasswordHasher {
  hash(password: string, saltRound?: number): Promise<string>

  compare(plain: string, hashed: string): Promise<boolean>
}

export interface IHashGenerator {
  generateSecret(size?: number, encoding?: BufferEncoding): string

  hash(input: string, encoding?: BufferEncoding): string

  hashMac(input: string, secret: string, encoding?: BufferEncoding): string
}
