import {VerifyOtpSchemaType} from "@api/auth/presentation";
import {OtpCode} from "@otp/domain";

export interface ICreateOtpUseCase {
    execute(phoneNumber: string, rawCode: string): Promise<OtpCode>
}
export interface IVerifyOtpUseCase {
    execute(verifyOtpBody: VerifyOtpSchemaType): Promise<void>
}