import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config({
  path: `./env/${process.env.NODE_ENV ?? 'development'}/.env`,
})

function readSecret(name: string): string | undefined {
  try {
    return readFileSync(`/run/secrets/${name}`, 'utf8').trim()
  } catch {
    return process.env[name]
  }
}

function requireValue(name: string): string {
  const value = readSecret(name)

  if (!value) {
    throw new Error(`Missing required configuration: ${name}`)
  }

  return value
}

const NODE_ENV = process.env.NODE_ENV ?? 'development'

const isDevelopment = NODE_ENV === 'development' || NODE_ENV === 'telemetry-test'

const DB_HOST = requireValue('DB_HOST')
const DB_PORT = Number(requireValue('DB_PORT'))
const DB_NAME = requireValue('DB_NAME')
const DB_ADMIN_USERNAME = requireValue('DB_ADMIN_USERNAME')

const dbCredentials = isDevelopment
  ? {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_ADMIN_USERNAME,
      password: requireValue('DB_PASSWORD'),
      database: DB_NAME,
    }
  : {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_ADMIN_USERNAME,
      database: DB_NAME,

      ssl: {
        ca: readFileSync(requireValue('POSTGRES_CA_PATH'), 'utf8'),
        cert: readFileSync(requireValue('POSTGRES_ADMIN_CERT_PATH'), 'utf8'),
        key: readFileSync(requireValue('POSTGRES_ADMIN_KEY_PATH'), 'utf8'),
        rejectUnauthorized: true,
      },
    }

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/*.model.ts',
  out: './drizzle/migrations',
  dbCredentials,
})
