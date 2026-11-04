import {ISendLoginOTP} from '@api/auth/application'
import {NotFoundError} from '@common/errors'
import {IUserRepository} from '@api/users/domain'
import {ILogger} from '@common/logger'
import {generateOtpCode, sendOTPSMS} from "@otp/util";
import {ConfigProvider} from "@common/configuration";
import {SMSService} from "@common/sender";
import {ICreateOtpUseCase} from "@otp/application";

export class SendLoginOtpUsecase implements ISendLoginOTP {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly createOtpUsecase: ICreateOtpUseCase,
        private readonly smsService: SMSService,
        private readonly configProvider: ConfigProvider,
        private readonly logger: ILogger,
    ) {
    }

    async execute(phoneNumber: string) {
        const user = await this.userRepository.findByPhoneNumber(phoneNumber)

        if (!user) {
            throw new NotFoundError({
                message: 'errors.user.notFound',
            })
        }

        const otp = this.configProvider.get('NODE_ENV') === 'production' ? generateOtpCode() : '12345'

        await this.createOtpUsecase.execute(phoneNumber, otp)

        await sendOTPSMS(user, otp,this.smsService, this.configProvider)

        this.logger.info('OTP sent successfully.', {
            module: 'SendLoginOtp',
            event: 'auth.sendLoginOtp',
            operation: 'sendLoginOtp',
            userId: user.id,
        })
    }
}
