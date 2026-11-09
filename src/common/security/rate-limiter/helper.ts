const isProd = process.env.NODE_ENV === 'production'

export const PUBLIC_READ_THROTTLE = { default: { ttl: 60_000, limit: isProd ? 120 : 10_000 } }
export const ADMIN_THROTTLE = { default: { ttl: 60_000, limit: isProd ? 60 : 10_000 } }