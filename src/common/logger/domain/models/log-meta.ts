export interface LogMeta {
  module?: string

  operation?: string

  userId?: string

  requestId?: string

  resourceId?: string

  event?: string

  durationMs?: number

  err?: unknown

  data?: Record<string, unknown>
}
