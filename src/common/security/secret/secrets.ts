import * as path from 'node:path'
import * as fs from 'node:fs'

export const Secrets = new Set([
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'POSTGRES_SUPERUSER',
  'POSTGRES_SUPERUSER_PASSWORD',
  'DB_APP_USERNAME',
  'DB_PASSWORD',
  'REDIS_URL',
  'JWT_SECRET_KEY',
  'CSRF_TOKEN_SECRET',
  'SESSION_SALT',
  'RESEND_API_KEY',
  'R2_TOKEN_VALUE',
  'R2_S3_ACCESS_KEY',
  'R2_S3_SECRET_KEY',
  'R2_S3_ENDPOINT',
  'R2_PUBLIC_BUCKET_NAME',
  'R2_PRIVATE_BUCKET_NAME',
  'R2_PUBLIC_BUCKET_ENDPOINT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'POSTGRES_CA_PATH',
  'POSTGRES_APP_CERT_PATH',
  'POSTGRES_APP_KEY_PATH',
  'POSTGRES_ADMIN_CERT_PATH',
  'POSTGRES_ADMIN_KEY_PATH',
  'REDIS_CA_PATH',
  'REDIS_APP_CERT_PATH',
  'REDIS_APP_KEY_PATH',
  'OWNER_EMAIL',
  'OWNER_USERNAME',
  'OWNER_PASSWORD',
  'SENTRY_DSN',
])
export const readSecret = (secretName: string) => {
  const secretPath = path.join('/run/secrets', secretName)
  try {
    return fs.readFileSync(secretPath, 'utf8').trim()
  } catch {
    return process.env[secretName] || null
  }
}
