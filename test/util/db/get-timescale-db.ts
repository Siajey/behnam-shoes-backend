import * as postgres from 'postgres'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'

export const getTimescaleDb = () => {
  const dbClient = postgres({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_APP_USERNAME,
    password: process.env.DB_PASSWORD,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  return drizzlePostgres({
    client: dbClient,
    casing: 'snake_case',
  })
}
