import { ILogger } from '@common/logger'
import { APP_LOGGER_SERVICE } from '@common/di'

type Constructor<T> = new (...args: any[]) => T

export const createProvider = <T>(
  token: symbol | string,
  classConstructor: Constructor<T>,
  injectTokens: Array<string | symbol>,
) => {
  return {
    provide: token,
    useFactory: (...deps: any[]) => {
      try {
        return new classConstructor(...deps)
      } catch (err) {
        const logger = deps.find(
          (dep) => dep && typeof dep.error === 'function',
        ) as ILogger | undefined
        const tokenToString =
          typeof token === 'string' ? token : token.toString()
        if (logger)
          logger.error(err.message, {
            module: tokenToString,
            err: err,
            operation: 'create provider',
            data: { tokens: injectTokens },
          })
        throw err
      }
    },
    inject: [...injectTokens, APP_LOGGER_SERVICE],
  }
}
