import {Module} from '@nestjs/common'

import {DatabaseModule} from '@common/db'
import {CryptoModule} from "@common/security";
import {OTP_REPOSITORY} from "@common/di";
import {OTPProviders, OtpRepository} from "./infrastructure";

@Module({
    imports: [DatabaseModule, CryptoModule],
    providers: [
        {
            provide: OTP_REPOSITORY,
            useClass: OtpRepository
        },
        ...OTPProviders],
    exports: [...OTPProviders],
})
export default class OtpModule {
}
