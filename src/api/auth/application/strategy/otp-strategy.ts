import {isIranianMobile} from '@common/validations'
import {NotFoundError, ValidationError} from '@common/errors'
import {SMSService} from '@common/sender'
import {LoginStrategy} from "@api/auth/application";
import {IUserRepository, User, UserRole, UserStatus} from "@api/users/domain";
import {ConfigProvider} from "@common/configuration";
import {PasswordLessLoginSchemaType} from "@api/auth/presentation";
import {sendOTPSMS, generateOtpCode} from "@otp/util";
import {ICreateOtpUseCase} from "@otp/application";

export default class OtpStrategy implements LoginStrategy {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly createOtpUsecase: ICreateOtpUseCase,
        private readonly smsService: SMSService,
        private readonly configProvider: ConfigProvider,
    ) {
    }

    async handleLogin(loginBody: PasswordLessLoginSchemaType): Promise<User> {
        if (!isIranianMobile(loginBody.credentials.phoneNumber)) {
            throw new ValidationError({
                message: 'errors.validation.invalidPhoneNumber',
            })
        }
        let user: User
        try {
            user = await this.userRepository.findByPhoneNumber(loginBody.credentials.phoneNumber)
        } catch (e) {
            if (e instanceof NotFoundError)
                user = await this.userRepository.save({
                    phoneNumber: loginBody.credentials.phoneNumber,
                    status: UserStatus.REGISTERED,
                    role: UserRole.USER,
                    createdAt: new Date(),
                } as User)
            else
                throw e
        }
        const otp = this.configProvider.get('NODE_ENV') === 'production' ? generateOtpCode() : '123456'

        await this.createOtpUsecase.execute(loginBody.credentials.phoneNumber, otp)

        await sendOTPSMS(user, otp, this.smsService, this.configProvider)

        return user
    }
}
