import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

export interface Session {
    cookies: Record<string, string>
    csrfToken: string
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/**
 * Thin wrapper around `app.inject` that sends the session cookies and the CSRF header.
 * Use `anonymousApi` / `apiWithoutCsrf` for the negative access cases.
 */
export class Api {
    constructor(
        private readonly app: NestFastifyApplication,
        private readonly session?: Session,
        private readonly sendCsrf = true,
    ) {
    }

    request(method: Method, url: string, payload?: unknown) {
        return this.app.inject({
            method,
            url,
            cookies: this.session?.cookies,
            headers: this.session && this.sendCsrf ? {'x-csrf-token': this.session.csrfToken} : undefined,
            payload: payload as any,
        })
    }

    get = (url: string) => this.request('GET', url)
    post = (url: string, payload?: unknown) => this.request('POST', url, payload ?? {})
    patch = (url: string, payload?: unknown) => this.request('PATCH', url, payload ?? {})
    put = (url: string, payload?: unknown) => this.request('PUT', url, payload ?? {})
    delete = (url: string) => this.request('DELETE', url)
}

export const anonymousApi = (app: NestFastifyApplication) => new Api(app)
export const apiWithoutCsrf = (app: NestFastifyApplication, session: Session) => new Api(app, session, false)

/** Builds a query string, skipping undefined/null values. Returns '' or '?a=1&b=2'. */
export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) search.set(key, String(value))
    }
    const out = search.toString()
    return out ? `?${out}` : ''
}

/** Follows `data.nextCursor` until it is falsy and returns every page's `data`. */
export const walkPages = async (api: Api, path: string, params: Record<string, any> = {}, maxPages = 50) => {
    const pages: any[] = []
    let nextCursor: string | undefined
    for (let i = 0; i < maxPages; i++) {
        const res = await api.get(`${path}${qs({...params, nextCursor})}`)
        expect(res.statusCode).toBe(200)
        const data = res.json().data
        pages.push(data)
        if (!data.nextCursor) return pages
        nextCursor = data.nextCursor
    }
    throw new Error('cursor never terminated')
}
