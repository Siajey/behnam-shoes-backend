import postgres from 'postgres'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { Provider } from '@nestjs/common'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

import { CONFIG_PROVIDER, DATABASE_CLIENT } from '@common/di'
import { ConfigProvider } from '@common/configuration'

import { DatabaseEngine } from './database-engine.enum'

export const DatabaseClientProvider: Provider = {
  provide: DATABASE_CLIENT,

  inject: [CONFIG_PROVIDER],

  useFactory: async (config: ConfigProvider) => {
    switch (config.get('DB') as DatabaseEngine) {
      case DatabaseEngine.POSTGRES: {
        const isProduction = config.get('NODE_ENV') === 'production'
        const ssl = isProduction
          ? {
              ca: readFileSync(config.get('POSTGRES_CA_PATH'), 'utf8'),
              cert: readFileSync(config.get('POSTGRES_APP_CERT_PATH'), 'utf8'),
              key: readFileSync(config.get('POSTGRES_APP_KEY_PATH'), 'utf8'),
              rejectUnauthorized: true,
            }
          : undefined

        return postgres({
          host: config.get('DB_HOST'),
          port: Number(config.get('DB_PORT')),
          database: config.get('DB_NAME'),
          username: config.get('DB_APP_USERNAME'),
          password: isProduction ? undefined : config.get('DB_PASSWORD'),
          ssl,
          max: 10,
          idle_timeout: 20,
          connect_timeout: 10,
        })
      }

      case DatabaseEngine.PGLITE:
        return new PGlite('database.pglite',{
            extensions: {
                pg_trgm,
            }
        })

      default:
        throw new Error(`Unsupported database engine: ${config.get('DB')}`)
    }
  },
}
