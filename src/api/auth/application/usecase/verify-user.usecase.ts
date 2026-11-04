import {IVerifyUser, VerifyUserBody} from '@api/auth/application'
import {IUserRepository, User, UserStatus} from '@api/users/domain'
import {ILogger} from '@common/logger'
import {ValidationError} from '@common/errors'
import {IVerifyOtpUseCase} from "@otp/application";

export class VerifyUserUseCase implements IVerifyUser {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly verifyOtpUsecase: IVerifyOtpUseCase,
        private readonly logger: ILogger,
    ) {
    }

    async execute(verifyOtpBody: VerifyUserBody): Promise<User> {
        await this.verifyOtpUsecase.execute(verifyOtpBody)

        await this.userRepository.updateByPhoneNumber(verifyOtpBody.phoneNumber, {status: UserStatus.ACTIVE})

        const user = await this.userRepository.findByPhoneNumber(verifyOtpBody.phoneNumber)

        if (!user) {
            throw new ValidationError({
                message: 'errors.validation.User_Not_Found',
                code: 'User_Not_Found',
            })
        }
        this.logger.info('User verified successfully.', {
            module: 'VerifyUserUseCase',
            event: 'auth.verifyUser',
            operation: 'verifyUser',
            userId: user.id,
        })

        return user

    }
}
