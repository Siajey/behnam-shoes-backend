import { HttpStatus } from '@nestjs/common'
import { HttpHeader } from 'fastify/types/utils'

export interface CookieModel {
  key: string
  value: string
  sameSite?: 'strict' | 'lax' | 'none'
  expires?: Date
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  maxAge?: number
}

export interface ApiResponse<T = any> {
  status: HttpStatus
  messageObj: {
    message: string
    options?: {
      lang?: string
      args?: Record<string, any>
    }
  }
  code: string
  timestamp: Date
  path: string
  data?: T
  meta?: Record<string, any>
  headers?: Partial<Record<HttpHeader, any>>
  cookies?: CookieModel[]
}

export class SuccessResponse<T = any> implements ApiResponse<T> {
  status: HttpStatus
  messageObj: {
    message: string
    options?: {
      lang?: string
      args?: Record<string, any>
    }
  }
  code: string
  timestamp: Date
  path: string
  data?: T
  meta?: Record<string, any>
  headers?: Partial<Record<HttpHeader, any>>
  cookies?: CookieModel[]

  constructor({
    status = HttpStatus.OK,
    code = 'SUCCESS',
    messageObj = {
      message: 'SUCCESS',
    },
    timestamp = new Date(),
    path,
    data,
    meta,
    headers,
    cookies,
  }: Partial<ApiResponse<T>> & { data: T; path: string }) {
    this.status = status
    this.code = code
    this.messageObj = messageObj
    this.timestamp = timestamp
    this.path = path
    this.data = data
    this.meta = meta
    this.headers = headers
    this.cookies = cookies
  }
}
