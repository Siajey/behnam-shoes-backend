import {
    CREATE_OTP_USE_CASE,
    createProvider,
    OTP_REPOSITORY,
    PASSWORD_HASHER,
    VERIFY_OTP_USE_CASE
} from "@common/di";
import {VerifyOtpUseCase, CreateOtpUseCase} from "../application";


export const OTPProviders = [
    createProvider<CreateOtpUseCase>(CREATE_OTP_USE_CASE, CreateOtpUseCase, [
        OTP_REPOSITORY,
        PASSWORD_HASHER
    ]),
    createProvider<VerifyOtpUseCase>(VERIFY_OTP_USE_CASE, VerifyOtpUseCase, [
        OTP_REPOSITORY,
        PASSWORD_HASHER
    ]),
]