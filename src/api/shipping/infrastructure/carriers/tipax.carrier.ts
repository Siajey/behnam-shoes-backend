import { Inject, Injectable } from '@nestjs/common'
import { ShippingCarrierError, TrackingStatus } from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'

import { CarrierTracking, IShippingCarrier } from '../../application/ports'

interface TipaxTokenResponse {
  accessToken?: string
  expiresIn?: number
}
interface TipaxEvent {
  date?: string
  description?: string
  branch?: string
}
interface TipaxTrackingResponse {
  status?: string
  statusTitle?: string
  events?: TipaxEvent[]
}

const DEFAULT_TOKEN_PATH = '/api/OM/v3/Account/token'
const DEFAULT_TRACKING_PATH = '/api/OM/v3/Tracking/{trackingCode}'


const STATUS_RULES: { status: TrackingStatus; pattern: RegExp }[] = [
  { status: 'returned', pattern: /return|مرجوع|برگشت/i },
  { status: 'failed', pattern: /cancel|undeliver|fail|لغو|ناموفق|تحویل نشد/i },
  { status: 'out_for_delivery', pattern: /out.?for.?delivery|در حال توزیع|خروج برای تحویل|در مسیر تحویل/i },
  { status: 'delivered', pattern: /deliver|تحویل به گیرنده|تحویل شد/i },
  { status: 'picked_up', pattern: /pick.?up|picked|جمع.?آوری|دریافت از فرستنده|تحویل از فرستنده/i },
  { status: 'created', pattern: /creat|regist|ثبت/i },
]

const classify = (text: string | undefined): TrackingStatus | null =>
  text ? (STATUS_RULES.find((r) => r.pattern.test(text))?.status ?? null) : null

const HAS_OFFSET = /(z|[+-]\d{2}:?\d{2})$/i
const parseTehranTime = (value: string): Date =>
  new Date(HAS_OFFSET.test(value) ? value : `${value}+03:30`)

const isRetryable = (status: number): boolean => status >= 500 || status === 429

@Injectable()
export class TipaxCarrier implements IShippingCarrier {
  readonly name = 'tipax'
  private token: { value: string; expiresAt: number } | null = null
  private pendingLogin: Promise<string> | null = null

  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}

  isValidTrackingCode(code: string): boolean {
    return /^[a-zA-Z0-9]{10,18}$/.test(code.trim())
  }

  async track(trackingCode: string): Promise<CarrierTracking> {
    const path = this.path('TIPAX_TRACKING_PATH', DEFAULT_TRACKING_PATH).replace(
      '{trackingCode}',
      encodeURIComponent(trackingCode.trim()),
    )

    let response = await this.authorized('track', path)
    if (response.status === 401) {
      this.token = null
      response = await this.authorized('track', path)
    }

    if (response.status === 404) return { status: 'created', events: [] }
    if (!response.ok) throw this.failure('track', `http_${response.status}`, isRetryable(response.status))

    return this.toTracking(await this.json<TipaxTrackingResponse>('track', response))
  }


  private toTracking(body: TipaxTrackingResponse): CarrierTracking {
    const events = (body.events ?? [])
      .flatMap((e) => {
        if (!e.date) return []
        const occurredAt = parseTehranTime(e.date)
        if (Number.isNaN(occurredAt.getTime())) return []
        return [
          {
            key: `${e.date}|${e.description ?? ''}`,
            status: classify(e.description) ?? ('in_transit' as TrackingStatus),
            description: e.description ?? '',
            location: e.branch ?? null,
            occurredAt,
          },
        ]
      })
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())

    const last = events[events.length - 1]
    return {
      status: classify(`${body.status ?? ''} ${body.statusTitle ?? ''}`) ?? last?.status ?? 'created',
      events,
    }
  }


  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value
    this.pendingLogin ??= this.login().finally(() => {
      this.pendingLogin = null
    })
    return this.pendingLogin
  }

  private async login(): Promise<string> {
    const response = await this.send('login', this.path('TIPAX_TOKEN_PATH', DEFAULT_TOKEN_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.get('TIPAX_USERNAME'),
        password: this.config.get('TIPAX_PASSWORD'),
        apiKey: this.config.get('TIPAX_API_KEY'),
      }),
    })
    if (!response.ok) throw this.failure('login', `http_${response.status}`, isRetryable(response.status))

    const body = await this.json<TipaxTokenResponse>('login', response)
    if (!body.accessToken) throw this.failure('login', 'no_token', false)

    const ttlSeconds = body.expiresIn && body.expiresIn > 120 ? body.expiresIn : 3600
    this.token = { value: body.accessToken, expiresAt: Date.now() + (ttlSeconds - 60) * 1000 }
    return body.accessToken
  }

  private async authorized(stage: string, path: string): Promise<Response> {
    const token = await this.accessToken()
    return this.send(stage, path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
  }


  private path(key: string, fallback: string): string {
    return this.config.getOptional(key) ?? fallback
  }

  private async send(stage: string, path: string, init: RequestInit): Promise<Response> {
    const base = (this.config.getOptional('TIPAX_BASE_URL') ?? 'https://omapi.tipax.ir').replace(/\/+$/, '')
    try {
      return await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(20_000) })
    } catch {
      throw this.failure(stage, 'unreachable', true)
    }
  }

  private async json<T>(stage: string, response: Response): Promise<T> {
    try {
      return (await response.json()) as T
    } catch {
      throw this.failure(stage, 'invalid_response', true)
    }
  }

  private failure(stage: string, code: string, retryable: boolean): ShippingCarrierError {
    return new ShippingCarrierError({ carrier: this.name, stage, code, retryable })
  }
}
