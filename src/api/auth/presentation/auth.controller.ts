import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Inject,
    Param,
    Post,
    Query,
    UnauthorizedException,
    UseGuards,
    UsePipes,
} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'
import * as process from 'node:process'

import {
    LocalLoginSchema,
    LocalLoginSchemaType,
    SignUpSchema,
    SignUpSchemaType,
} from './dto'
import {ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from '@common/api'
import {
    ChangePasswordBody,
    CsrfTokenUsecase,
    IChangePassword,
    IForgotPassword,
    ILogin,
    ILogout,
    IRefreshToken,
    IResetPassword,
    ISendConfirmationLink,
    ISignUp,
    IVerifyUser,
    LoginBody,
    SignUpBody,
} from '@api/auth/application'
import {User, UserRole, UserStatus} from '@api/users/domain'
import {
    AUTH_TOKEN_SERVICE,
    CHANGE_PASSWORD,
    CSRF_TOKEN_USE_CASE,
    FORGOT_PASSWORD,
    LOGIN,
    LOGOUT,
    REFRESH_TOKEN,
    RESET_PASSWORD,
    SEND_CONFIRMATION_EMAIL,
    SIGN_UP,
    VERIFY_USER,
} from '@common/di'
import {GoogleStrategy} from '@api/auth/infrastructure'
import {
    ChangePasswordSchema,
    ChangePasswordSchemaType,
    ForgotPasswordSchema,
    ForgotPasswordSchemaType,
    ResetPasswordSchema,
    ResetPasswordSchemaType,
} from '@common/dto'
import {RefreshToken, ReqUser} from '@common/decorator'
import {ISessionService} from '@session/application'
import {CSRFGuard, JwtSessionGuard} from '@session/presentation'
import {NonOperationalError} from '@common/errors'

@Controller('auth')
export default class AuthController {
    constructor(
        readonly _googleStrategy: GoogleStrategy,
        @Inject(AUTH_TOKEN_SERVICE)
        private readonly authTokenService: ISessionService,
        @Inject(VERIFY_USER)
        private readonly verifyUser: IVerifyUser,
        @Inject(SIGN_UP)
        private readonly signUpUseCase: ISignUp,
        @Inject(LOGIN)
        private readonly loginUseCase: ILogin,
        @Inject(FORGOT_PASSWORD)
        private readonly forgotPassword: IForgotPassword,
        @Inject(RESET_PASSWORD)
        private readonly resetPassword: IResetPassword,
        @Inject(CHANGE_PASSWORD)
        private readonly changePassword: IChangePassword,
        @Inject(REFRESH_TOKEN)
        private readonly refreshToken: IRefreshToken,
        @Inject(CSRF_TOKEN_USE_CASE)
        private readonly csrfTokenUsecase: CsrfTokenUsecase,
        @Inject(SEND_CONFIRMATION_EMAIL)
        private readonly sendConfirmationEmail: ISendConfirmationLink,
        @Inject(LOGOUT)
        private readonly logout: ILogout,
    ) {
    }

    @Throttle({
        default: {
            ttl: 30000,
            limit: 5,
        },
    })
    @UsePipes(new ZodValidationPipe(SignUpSchema))
    @Post('sign-up')
    public async signUp(@Body() signUpDto: SignUpSchemaType) {
        const email = await this.signUpUseCase.execute({
            ...signUpDto,
            status: UserStatus.INACTIVE,
            role: UserRole.USER,
        } as SignUpBody)
        return new SuccessResponse({
            messageObj: {
                message: 'common.auth.signupSuccess',
                options: {args: {email: email}},
            },
            code: 'SIGN_UP_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/sign-up',
            status: HttpStatus.CREATED,
        })
    }

    @Throttle({
        default: {
            ttl: 30000,
            limit: 5,
        },
    })
    @Post('login')
    @UsePipes(new ZodValidationPipe(LocalLoginSchema))
    public async login(@Body() loginBody: LocalLoginSchemaType) {
        const user = await this.loginUseCase.execute(loginBody as LoginBody)
        const {cookies, csrfToken} = await this.authTokenService.generateAuthSession(
            user.id,
        )
        return new SuccessResponse({
            messageObj: {
                message: 'common.auth.loginSuccess',
                options: {args: {email: loginBody.emailOrUsername}},
            },
            code: 'LOGIN_SUCCESS',
            timestamp: new Date(),
            path: '/auth/login',
            status: HttpStatus.OK,
            data: {
                csrfToken
            },
            cookies: cookies,
        })
    }

    @Post('verify-user')
    async verifyUserController(@Query('token') token: string) {
        await this.verifyUser.execute(token)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.verifyUserSuccess'},
            code: 'verifyUserSuccess',
            data: null,
            timestamp: new Date(),
            path: '/auth/verify-user',
            status: HttpStatus.OK,
        })
    }

    @Throttle({
        default: {
            ttl: 60000,
            limit: 3,
        },
    })
    @Post('forgot-password')
    @UsePipes(new ZodValidationPipe(ForgotPasswordSchema))
    public async forgotPasswordController(
        @Body() forgotPasswordBody: ForgotPasswordSchemaType,
    ) {
        await this.forgotPassword.execute(forgotPasswordBody.email)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.forgotPasswordSuccess'},
            code: 'FORGOT_PASSWORD_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/forgot-password',
            status: HttpStatus.OK,
        })
    }

    @Throttle({
        default: {
            ttl: 30000,
            limit: 3,
        },
    })
    @Post('reset-password')
    public async resetPasswordController(
        @Body() resetBody: ResetPasswordSchemaType,
        @Query('token') token: string,
    ) {
        const parsedBody = ResetPasswordSchema.parse(resetBody)
        await this.resetPassword.execute({
            newPassword: parsedBody.newPassword,
            confirmPassword: parsedBody.confirmPassword,
            resetToken: token,
        })
        const cookies = this.authTokenService.clearCookies()
        return new SuccessResponse({
            messageObj: {message: 'common.auth.resetPasswordSuccess'},
            code: 'RESET_PASSWORD_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/reset-password',
            status: HttpStatus.OK,
            cookies,
        })
    }

    @Throttle({
        default: {
            ttl: 60000,
            limit: process.env.NODE_ENV === 'test' ? 10 : 5,
        },
    })
    @UseGuards(CSRFGuard, JwtSessionGuard)
    @Post('change-password')
    async changePasswordController(
        @Body() changePasswordBody: ChangePasswordSchemaType,
        @ReqUser() user: User,
    ) {
        const parsedBody = ChangePasswordSchema.parse(changePasswordBody)
        await this.changePassword.execute({
            ...parsedBody,
            userId: user.id,
        } as ChangePasswordBody)
        const cookies = this.authTokenService.clearCookies()
        return new SuccessResponse({
            messageObj: {message: 'common.auth.changePasswordSuccess'},
            code: 'CHANGE_PASSWORD_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/change-password',
            status: HttpStatus.OK,
            cookies,
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
        const csrfCookies = await this.csrfTokenUsecase.execute()
        return new SuccessResponse({
            data: null,
            status: HttpStatus.OK,
            cookies: csrfCookies,
            timestamp: new Date(),
            code: 'CSRF_TOKEN_SUCCESS',
            messageObj: {message: 'common.auth.csrfTokenSuccess'},
            path: '/auth/csrf-token',
        })
    }

    @Throttle({
        default: {
            ttl: 120000,
            limit: 1,
        },
    })
    @Get('send-confirm-email/:email')
    async sendConfirmEmailController(@Param('email') email: string) {
        await this.sendConfirmationEmail.execute(email)
        return new SuccessResponse({
            messageObj: {message: 'common.auth.resendEmailConfirmationSuccess'},
            code: 'RESEND_EMAIL_CONFIRMATION_SUCCESS',
            data: null,
            timestamp: new Date(),
            path: '/auth/send-confirm-email',
            status: HttpStatus.OK,
        })
    }

    @Throttle({
        default: {
            ttl: 120000,
            limit: 1,
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
