import { VerifyOtpSchemaType } from '@api/auth/presentation'
import {IVerifyOtpUseCase} from "../index";
import {IOtpRepository} from "@otp/domain";
import {IPasswordHasher} from "@common/security";
import {ValidationError} from "@common/errors";

export default class VerifyOtpUseCase implements IVerifyOtpUseCase{
    constructor(
        private readonly otpRepo: IOtpRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(verifyOtpBody: VerifyOtpSchemaType): Promise<void> {
        const otp = await this.otpRepo.findLatestUnused(
            verifyOtpBody.phoneNumber,
        )

        if (!otp) {
            throw new ValidationError({
                message: 'errors.validation.otp.notFound',
                code: 'OTP_NOT_FOUND',
            })
        }

        if (otp.expiresAt < new Date()) {
            throw new ValidationError({
                message: 'errors.validation.otp.expired',
                code: 'OTP_EXPIRED',
            })
        }

        const isValid = await this.passwordHasher.compare(
            verifyOtpBody.otp,
            otp.codeHash,
        )

        if (!isValid) {
            throw new ValidationError({
                message: 'errors.validation.otp.invalid',
                code: 'OTP_INVALID',
            })
        }

        await this.otpRepo.delete(otp.id)
    }
}