import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common'
import { ZodError } from 'zod'
import { I18nContext, I18nService } from 'nestjs-i18n'
import { FastifyReply, FastifyRequest } from 'fastify'
import { DrizzleQueryError } from 'drizzle-orm'
import * as Sentry from '@sentry/nestjs'

import { AppError } from './app-error'
import { ApiResponse } from '@common/api'
import { ILogger } from '@common/logger'
import { translateZodMessages } from '@common/validations'
import { APP_LOGGER_SERVICE } from '@common/di'
// TODO
// import { handleDatabaseError } from '@common/db'

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(APP_LOGGER_SERVICE) private logger: ILogger,
    @Inject() private i18n: I18nService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<FastifyRequest>()
    const response = ctx.getResponse<FastifyReply>()

    const i18nLang = I18nContext.current(host)?.lang || 'en'
    let apiRes: ApiResponse = {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      messageObj: {
        message: this.i18n.t('errors.internalServerError', {
          lang: i18nLang,
        }),
      },
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date(),
      path: request.url,
    }

    if (exception instanceof HttpException) {
      apiRes.status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse['message']
      ) {
        apiRes.code = exceptionResponse['code']
        apiRes.messageObj = {
          message:
            this.i18n.t(exceptionResponse['message'], { lang: i18nLang }) ||
            exception.message,
        }
      } else {
        apiRes.messageObj = {
          message: this.i18n.t(exceptionResponse.toString(), {
            lang: i18nLang,
          }),
        }
      }
      apiRes.code = exceptionResponse['error'] || apiRes.code
    } else if (exception instanceof AppError) {
      apiRes.status = exception.status || HttpStatus.BAD_REQUEST
      apiRes.messageObj = {
        message: this.i18n.t(exception.message, { lang: i18nLang }),
      }
      apiRes.code = exception.code
      if (
        !exception.message.startsWith('errors.validation.') &&
        !exception.isOperational &&
        exception.status !== HttpStatus.BAD_REQUEST
      )
        this.logger.error(exception.message, {
          err: exception,
          userId: ctx.getRequest()?.user?.id || undefined,
          module: 'GlobalExceptionFilter',
          event: 'app.exception',
          operation: 'exception',
        })
    } else if (exception instanceof ZodError) {
      apiRes = this.handleZodExceptions(apiRes, exception, i18nLang)
    } else if (exception instanceof DrizzleQueryError) {
      // apiRes = handleDatabaseError(
      //   apiRes,
      //   i18nLang,
      //   this.i18n,
      //   exception,
      //   this.logger,
      //   ctx.getRequest()?.user?.id || undefined,
      // )
    } else {
      if (process.env.NODE_ENV === 'production')
        Sentry.captureException(exception)
      if (
        typeof exception === 'object' &&
        'stack' in exception &&
        typeof exception.stack === 'string'
      )
        this.logger.error('Unexpected Error', {
          err: exception,
          userId: ctx.getRequest()?.user?.id || undefined,
          module: 'GlobalExceptionFilter',
          event: 'app.exception',
          operation: 'exception',
        })
      else
        this.logger.error('Unexpected Error', {
          err: exception,
          userId: ctx.getRequest()?.user?.id || undefined,
          module: 'GlobalExceptionFilter',
          event: 'app.exception',
          operation: 'exception',
        })
    }

    return response.status(apiRes.status).send({
      message: apiRes.messageObj.message,
      code: apiRes.code,
      timestamp: apiRes.timestamp,
      path: apiRes.path,
    })
  }

  private handleZodExceptions = (
    response: ApiResponse,
    exception: ZodError,
    lang: string,
  ): ApiResponse => {
    return {
      ...response,
      status: HttpStatus.BAD_REQUEST,
      messageObj: {
        message: translateZodMessages(this.i18n, exception.issues, lang).join(
          ', ',
        ),
      },
      code: 'VALIDATION_ERROR',
    }
  }
}
