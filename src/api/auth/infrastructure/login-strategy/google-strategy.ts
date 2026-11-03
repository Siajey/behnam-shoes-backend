import { Inject, Injectable } from '@nestjs/common'
import { Strategy, VerifyCallback } from 'passport-google-oauth2'
import { HttpAdapterHost } from '@nestjs/core'
import fastifyPassport from '@fastify/passport'
import { FastifyInstance } from 'fastify'
import { preValidationHookHandler } from 'fastify'

import { ISessionService } from '@session/application'
import { IUserRepository, User, UserRole, UserStatus } from '@api/users/domain'
import { ConfigProvider } from '@common/configuration'
import {
  APP_LOGGER_SERVICE,
  AUTH_TOKEN_SERVICE,
  CONFIG_PROVIDER,
  HASH_GENERATOR,
  USER_REPOSITORY,
} from '@common/di'
import { IHashGenerator } from '@common/security'
import { ILogger } from '@common/logger'
import { AppError, NotFoundError } from '@common/errors'
import { generateProviderUsername } from '@common/util'

@Injectable()
export default class GoogleStrategy {
  constructor(
    @Inject(CONFIG_PROVIDER)
    private readonly configProvider: ConfigProvider,
    @Inject(AUTH_TOKEN_SERVICE)
    private readonly sessionService: ISessionService,
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(HASH_GENERATOR)
    private readonly hashGenerator: IHashGenerator,
    @Inject(APP_LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    fastifyPassport.use(
      'google',
      new Strategy(
        {
          clientID: configProvider.get('GOOGLE_CLIENT_ID'),
          clientSecret: configProvider.get('GOOGLE_CLIENT_SECRET'),
          callbackURL: configProvider.get('GOOGLE_CALLBACK_URL'),
          passReqToCallback: true,
          scope: ['profile', 'email'],
        },
        this.verify.bind(this),
      ),
    )
    fastifyPassport.registerUserDeserializer(async (id: string) => {
      return id
    })
    this.registerUserSerializer()
  }

  async verify(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      const email = profile.emails?.[0]?.value

      if (!email) {
        return done(
          new AppError({
            message: 'Google account does not provide an email address',
            code: 'VALIDATION_ERROR',
          }),
        )
      }

      const existingUser =
        await this.userRepository.findContactByEmail(email)

      if (existingUser) {
        return done(null, existingUser)
      }

      const username =
        generateProviderUsername(email, 'google', this.hashGenerator)

      const passwordHash = this.hashGenerator.hash(
        this.hashGenerator.generateSecret(),
      )

      const user = await this.userRepository.save({
        email,
        username,
        passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      } as User)

      this.logger.info(
        'User signed in with Google provider successfully.',
        {
          module: 'GoogleStrategy',
          event: 'auth.googleLogin',
          operation: 'login',
          userId: user.id,
        },
      )

      return done(null, user)
    } catch (error) {
      this.logger.error('Google authentication failed.', {
        module: 'GoogleStrategy',
        event: 'auth.googleLogin',
        operation: 'login',
        err: error,
      })

      return done(error)
    }
  }

  // We must use fastifyPassport.authenticate('google') because nestjs/passport package doesn't work with fastify
  onModuleInit = () => {
    const fastifyAdapter =
      this.adapterHost.httpAdapter.getInstance() as FastifyInstance
    fastifyAdapter.get('/api/v2/auth/google', (req, reply) => {
      const clientId = this.configProvider.get('GOOGLE_CLIENT_ID')
      const redirectUri = this.configProvider.get('GOOGLE_CALLBACK_URL')

      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'profile email',
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'select_account',
      })

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`

      reply.redirect(url)
    })

    fastifyAdapter.get(
      '/api/v2/auth/google/callback',
      {
        preValidation: fastifyPassport.authenticate('google', {
          session: false,
          failureMessage:
            'Failed to redirect, please check your internet connection and try later.',
          failureRedirect:
            this.configProvider.get('FRONTEND_GOOGLE_SIGN_IN_CALLBACK_URL') + '?status=failure',
        }) as unknown as preValidationHookHandler,
      },
      async (req, reply) => {
        const user = req.user as User
        const cookies = await this.sessionService.generateAuthSession(user.id)
        cookies.forEach((cookie) => {
          reply.setCookie(cookie.key, cookie.value, { ...cookie })
        })
        reply.redirect(
          this.configProvider.get('FRONTEND_GOOGLE_SIGN_IN_CALLBACK_URL') + '?status=success',
        )
      },
    )
  }

  private registerUserSerializer = () => {
    fastifyPassport.registerUserSerializer(async (user: any) => {
      return user.id
    })
  }
}
