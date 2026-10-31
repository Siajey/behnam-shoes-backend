import { Global, Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'

import { APP_LOGGER_SERVICE } from '@common/di'
import { AppLoggerService } from './infrastructure'

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
              }
            : undefined,
        autoLogging: {
          ignore: (req: any) =>
            req.originalUrl.includes('/health') || req.originalUrl.includes('/device/telemetry'),
        },
        formatters: {
          level(label) {
            return { level: label }
          },
        },
        messageKey: 'message',
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              id: req.id,
            }
          },
          res(res) {
            return { statusCode: res.statusCode }
          },
        },
      },
    }),
  ],
  providers: [
    {
      provide: APP_LOGGER_SERVICE,
      useClass: AppLoggerService,
    },
  ],
  exports: [APP_LOGGER_SERVICE],
})
export default class AppLoggerModule {}
