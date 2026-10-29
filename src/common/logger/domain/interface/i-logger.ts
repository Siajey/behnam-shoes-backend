import { LogMeta } from '../models'

export interface ILogger {
  debug(message: string, meta?: LogMeta): Promise<void>

  info(message: string, meta?: LogMeta): Promise<void>

  warn(message: string, meta?: LogMeta): Promise<void>

  error(message: string, meta?: LogMeta): Promise<void>
}
