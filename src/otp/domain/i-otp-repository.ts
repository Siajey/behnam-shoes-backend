import OtpCode from "./otp-code"

export interface CreateOtpInput {
    phoneNumber: string
    codeHash: string
    expiresAt: Date
}

export interface IOtpRepository {
    create(input: CreateOtpInput): Promise<OtpCode>

    findLatestUnused(phoneNumber: string): Promise<OtpCode | null>

    delete(id: string): Promise<void>
}