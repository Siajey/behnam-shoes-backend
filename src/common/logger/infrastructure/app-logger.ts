import { Inject, Injectable } from '@nestjs/common'
import { Params, PinoLogger } from 'nestjs-pino'

import { CONFIG_PROVIDER } from '@common/di'
import { ConfigProvider } from '@common/configuration'

import { ILogger, LogMeta } from '../domain'

@Injectable()
export class AppLoggerService implements ILogger {
  private readonly logger: PinoLogger

  constructor(
    @Inject(CONFIG_PROVIDER)
    config: ConfigProvider,
  ) {
    const isProduction = ['production', 'test'].includes(config.get('NODE_ENV'))

    const params: Params = {
      pinoHttp: {
        level: isProduction ? 'info' : 'debug',

        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },

        redact: isProduction
          ? {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                '*.password',
                '*.token',
              ],
              censor: '[REDACTED]',
            }
          : undefined,

        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              id: req.id,
            }
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            }
          },
        },

        base: {
          env: config.get('NODE_ENV'),
          app: config.get('APP_NAME') ?? 'app',
        },

        formatters: {
          level(label) {
            return { level: label }
          },
        },
        messageKey: 'message',
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      },
    }

    this.logger = new PinoLogger(params)
    this.logger.setContext(AppLoggerService.name)
  }

  async info(message: string, meta?: LogMeta): Promise<void> {
    this.logger.info(meta ?? {}, message)
  }

  async warn(message: string, meta?: LogMeta): Promise<void> {
    this.logger.warn(meta ?? {}, message)
  }

  async debug(message: string, meta?: LogMeta): Promise<void> {
    this.logger.debug(meta ?? {}, message)
  }

  async error(message: string, meta?: LogMeta): Promise<void> {
    this.logger.error(meta ?? {}, message)
  }
}
