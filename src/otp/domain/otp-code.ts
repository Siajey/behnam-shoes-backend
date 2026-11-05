export default interface OtpCode {
  id: string
  phoneNumber: string
  codeHash: string
  expiresAt: Date
  used: boolean
  createdAt: Date
}
