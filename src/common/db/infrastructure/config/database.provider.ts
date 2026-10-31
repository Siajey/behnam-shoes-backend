import { Provider } from '@nestjs/common'
import postgres from 'postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePostgres, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePGlite } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { sql } from 'drizzle-orm'

import { APP_LOGGER_SERVICE, CONFIG_PROVIDER, DATABASE, DATABASE_CLIENT } from '@common/di'
import { ConfigProvider } from '@common/configuration'
import { ILogger } from '@common/logger'

export type Database<TSchema extends Record<string, unknown>> = PostgresJsDatabase<TSchema>

export const DatabaseProvider: Provider = {
  provide: DATABASE,
  inject: [CONFIG_PROVIDER, APP_LOGGER_SERVICE, DATABASE_CLIENT],
  useFactory: async (config: ConfigProvider, logger: ILogger, client: postgres.Sql | PGlite) => {
    if (client instanceof PGlite) {
      return await createPGliteConnection(logger, client)
    }

    return await createPostgresConnection(config, logger, client)
  },
}

const createPostgresConnection = async (
  config: ConfigProvider,
  logger: ILogger,
  client: postgres.Sql,
) => {
  const db = drizzlePostgres({
    client,
    casing: 'snake_case',
  })

  try {
    await db.execute(sql.raw(`SELECT 1`))

    logConnected(logger, {
      database: 'postgres',
      host: config.get('DB_HOST'),
      databaseName: config.get('DB_NAME'),
    })
  } catch (error) {
    logger.error('Database connection failed', {
      module: 'DatabaseModule',
      event: 'db.connect',
      operation: 'startup',
      err: error,
    })
    throw error
  }

  return db
}

const createPGliteConnection = async (logger: ILogger, client: PGlite) => {
  try {
    const db = drizzlePGlite({
      client,
      casing: 'snake_case',
    })

    await migrate(db, {
      migrationsFolder: './drizzle/migrations',
    })

    await db.execute(sql.raw(`SELECT 1`))

    logConnected(logger, {
      database: 'pglite',
      path: 'database.pglite',
    })
    return db
  } catch (error) {
    logger.error('Database connection failed', {
      module: 'DatabaseModule',
      event: 'db.connect',
      operation: 'startup',
      err: error,
    })
    throw error
  }
}

const logConnected = (logger: ILogger, data: Record<string, unknown>) => {
  logger.info('Database connected successfully', {
    module: 'DatabaseModule',
    event: 'db.connect',
    operation: 'startup',
    data,
  })
}
