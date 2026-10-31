import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { FastifyReply } from 'fastify'

import { SuccessResponse } from './api-response'
import { I18nService } from 'nestjs-i18n'
import { serializeCookie } from '../util'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'

@Injectable()
export default class ApiResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly i18n: I18nService,
    @Inject(CONFIG_PROVIDER)
    private readonly configService: ConfigProvider,
  ) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const ctx = context.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    return next.handle().pipe(
      tap((data) => {
        if (data instanceof SuccessResponse) {
          if (data.headers) {
            Object.entries(data.headers).forEach(([k, v]) => {
              response.header(k, v)
            })
          }
          if (data.cookies) {
            if (this.configService.get('NODE_ENV') !== 'test')
              data.cookies.forEach((cookie) => {
                response.cookie(cookie.key, cookie.value, {
                  ...cookie,
                })
              })
            else {
              const serializedCookies = data.cookies.map(serializeCookie)
              response.header('set-cookie', serializedCookies)
            }
          }
          response.status(data.status).send({
            message: this.i18n.t(
              data.messageObj.message,
              data.messageObj.options,
            ),
            code: data.code,
            timestamp: data.timestamp,
            path: data.path,
            data: data.data,
            meta: data.meta,
          })
        }
      }),
    )
  }
}
