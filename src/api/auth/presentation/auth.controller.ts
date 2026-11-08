import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Inject,
    Param,
    Post,
    UnauthorizedException,
    UseGuards,
    UsePipes,
} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {
    LoginSchema,
    LoginSchemaType,
    VerifyOtpSchema,
    VerifyOtpSchemaType,
} from './dto'
import {ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from '@common/api'
import {
    CsrfTokenUsecase,
    ILogin,
    ILogout,
    IRefreshToken,
    ISendLoginOTP,
    IVerifyUser,
    LoginBody,
} from '@api/auth/application'
import {User} from '@api/users/domain'
import {
    AUTH_TOKEN_SERVICE,
    CSRF_TOKEN_USE_CASE,
    LOGIN,
    LOGOUT,
    REFRESH_TOKEN,
    SEND_LOGIN_OTP,
    VERIFY_USER_OTP,
} from '@common/di'
import {RefreshToken, ReqUser} from '@common/decorator'
import {ISessionService} from '@api/session/application'
import {CSRFGuard, JwtSessionGuard} from '@api/session/presentation'

@Controller('auth')
export default class AuthController {
    constructor(
        @Inject(AUTH_TOKEN_SERVICE)
        private readonly authTokenService: ISessionService,
        @Inject(VERIFY_USER_OTP)
        private readonly verifyUser: IVerifyUser,
        @Inject(LOGIN)
        private readonly loginUseCase: ILogin,
        @Inject(REFRESH_TOKEN)
        private readonly refreshToken: IRefreshToken,
        @Inject(CSRF_TOKEN_USE_CASE)
        private readonly csrfTokenUsecase: CsrfTokenUsecase,
        @Inject(SEND_LOGIN_OTP)
        private readonly sendLoginOtp: ISendLoginOTP,
        @Inject(LOGOUT)
        private readonly logout: ILogout,
    ) {
    }

    @Throttle({
        default: {
            ttl: 30000,
            limit: process.env.NODE_ENV === 'production' ? 5 : 100,
        },
    })
    @Post('login')
    @UsePipes(new ZodValidationPipe(LoginSchema))
    public async login(@Body() loginBody: LoginSchemaType) {
        await this.loginUseCase.execute(loginBody as LoginBody)

        const successResponse = new SuccessResponse({
            messageObj: {
                message: 'common.auth.loginSuccess',
                options: {args: {email: loginBody.credentials.phoneNumber}},
            },
            code: 'LOGIN_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/login',
            status: HttpStatus.OK,
        })
        if (loginBody.loginMethod === 'otp') {
            successResponse.messageObj = {
                message: 'common.auth.otpSentSuccess',
            }
            successResponse.code = 'OTP_SENT_SUCCESS'
        }
        return successResponse
    }

    @Throttle({
        default: {
            ttl: 60000,
            limit: process.env.NODE_ENV === 'production' ? 5 : 100,
        },
    })
    @Post('verify-login-otp')
    @UsePipes(new ZodValidationPipe(VerifyOtpSchema))
    public async verifyOtp(@Body() verifyOtpBody: VerifyOtpSchemaType) {
        const user = await this.verifyUser.execute(verifyOtpBody)
        const session = await this.authTokenService.generateAuthSession(user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.otpVerifiedSuccess'},
            code: 'verifyUserSuccess',
            data: {
                csrfToken: session.csrfToken
            },
            timestamp: new Date(),
            path: '/auth/verify-login-otp',
            status: HttpStatus.OK,
            cookies: session.cookies
        })
    }

    @Post('refresh-token')
    async refreshTokenController(@RefreshToken() refreshToken: string) {
        if (!refreshToken || refreshToken.trim() === '')
            throw new UnauthorizedException('errors.sessions.missingRefreshToken')
        const cookies = await this.refreshToken.execute(refreshToken)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.tokensRefreshedSuccess'},
            code: 'TOKENS_REFRESHED_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/refresh-token',
            status: HttpStatus.OK,
            cookies: [cookies.accessCookie, cookies.refreshCookie],
        })
    }

    @Post('csrf-token')
    async csrfToken() {
        const {csrfToken, cookie} = this.csrfTokenUsecase.execute()
        return new SuccessResponse({
            data: {csrfToken},
            status: HttpStatus.OK,
            cookies: [cookie],
            timestamp: new Date(),
            code: 'CSRF_TOKEN_SUCCESS',
            messageObj: {message: 'common.auth.csrfTokenSuccess'},
            path: '/auth/csrf-token',
        })
    }

    @Throttle({
        default: {
            ttl: 120000,
            limit: process.env.NODE_ENV === 'production' ? 1 : 100,
        },
    })
    @Get('send-login-otp/:phoneNumber')
    async sendLoginOtpController(@Param('phoneNumber') phoneNumber: string) {
        await this.sendLoginOtp.execute(phoneNumber)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.otpSentSuccess'},
            code: 'RESEND_LOGIN_OTP_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: `/auth/send-login-otp/${phoneNumber}`,
            status: HttpStatus.OK,
        })
    }

    @Throttle({
        default: {
            ttl: 120000,
            limit: process.env.NODE_ENV === 'production' ? 1 : 100,
        },
    })
    @UseGuards(CSRFGuard, JwtSessionGuard)
    @Post('logout')
    async logoutController(@ReqUser() user: User) {
        await this.logout.execute(user.id)
        const cookies = this.authTokenService.clearCookies()
        return new SuccessResponse({
            messageObj: {message: 'common.auth.logoutSuccess'},
            code: 'LOGOUT_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/logout',
            status: HttpStatus.OK,
            cookies: cookies,
        })
    }
}
