import {createServer, IncomingMessage, Server, ServerResponse} from 'node:http'
import {AddressInfo} from 'node:net'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {PaymentGatewayError} from '@api/payment/domain'
import {ConfigProvider} from '@common/configuration'
import {ZibalGateway} from "@api/payment/infrastructure/gateways"
import {AppError} from "@common/errors";

interface CapturedRequest {
    method?: string
    url?: string
    contentType?: string
    body: Record<string, unknown>
}

describe('ZibalGateway (integration)', () => {
    let server: Server
    let baseUrl: string
    let gateway: ZibalGateway
    let requests: CapturedRequest[]
    let nextHandler: (req: CapturedRequest, res: ServerResponse) => void

    const configValues: Record<string, string | undefined> = {
        ZIBAL_MERCHANT: 'zibal',
        ZIBAL_AMOUNT_MULTIPLIER: '10',
    }

    const config: ConfigProvider = {
        get: (key: string) => {
            const val = configValues[key]
            if (val === undefined) throw new Error(`Missing config key: ${key}`)
            return val
        },
        getOptional: (key: string) => configValues[key],
    } as unknown as ConfigProvider

    const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
        const chunks: Buffer[] = []
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    }

    beforeAll(async () => {
        server = createServer(async (req, res) => {
            const parsedBody = await readJsonBody(req).catch(() => ({}))
            const captured: CapturedRequest = {
                method: req.method,
                url: req.url,
                contentType: req.headers['content-type'],
                body: parsedBody,
            }
            requests.push(captured)
            nextHandler(captured, res)
        })

        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', () => resolve())
        })

        const {port} = server.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${port}`
        configValues.ZIBAL_BASE_URL = baseUrl
        gateway = new ZibalGateway(config)
    })

    beforeEach(() => {
        requests = []
        configValues.ZIBAL_MERCHANT = 'zibal'
        configValues.ZIBAL_AMOUNT_MULTIPLIER = '10'
        configValues.ZIBAL_BASE_URL = baseUrl
        nextHandler = (_req, res) => {
            res.writeHead(200, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({result: 100, trackId: 987654}))
        }
    })

    afterEach(() => {
        server.removeAllListeners('close')
    })

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()))
        })
    })

    describe('requestPayment', () => {
        it('sends multiplied amount and payment metadata to /v1/request and returns reference + start URL', async () => {
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({result: 100, trackId: 445566, message: 'success'}))
            }

            const target = await gateway.requestPayment({
                paymentId: 'pay-123',
                amount: 2500,
                callbackUrl: 'https://shop.test/api/payments/callback/zibal',
                description: 'Order #1001',
            })
            expect(target).toEqual({
                reference: '445566',
                redirectUrl: `${baseUrl}/start/445566`,
            })
            expect(requests).toHaveLength(1)
            expect(requests[0]).toMatchObject({
                method: 'POST',
                url: '/v1/request',
                contentType: 'application/json',
                body: {
                    merchant: 'zibal',
                    amount: 25000,
                    callbackUrl: 'https://shop.test/api/payments/callback/zibal',
                    description: 'Order #1001',
                    orderId: 'pay-123',
                },
            })
        })

        it('respects custom ZIBAL_AMOUNT_MULTIPLIER and strips trailing slash from ZIBAL_BASE_URL', async () => {
            configValues.ZIBAL_AMOUNT_MULTIPLIER = '1'
            configValues.ZIBAL_BASE_URL = `${baseUrl}///`
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({result: 100, trackId: 101}))
            }

            const target = await gateway.requestPayment({
                paymentId: 'pay-1',
                amount: 500,
                callbackUrl: 'https://shop.test/callback',
                description: 'Direct IRT',
            })

            expect(requests[0].body.amount).toBe(500)
            expect(target.redirectUrl).toBe(`${baseUrl}/start/101`)
        })

        it('throws PaymentGatewayError when Zibal returns non-100 result or omits trackId', async () => {
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    result: 102,
                    message: 'merchant not found',
                }))
            }

            await expect(
                gateway.requestPayment({
                    paymentId: 'pay-err',
                    amount: 1000,
                    callbackUrl: 'https://shop.test/callback',
                    description: 'Fail case',
                }),
            ).rejects.toMatchObject({
                name: 'AppError',
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'request',
                    code: '102',
                },
            })
        })
    })

    describe('parseCallback', () => {
        it('extracts and trims trackId, returning null when missing or blank', () => {
            expect(gateway.parseCallback({trackId: '  778899  '})).toEqual({reference: '778899'})
            expect(gateway.parseCallback({trackId: '   '})).toBeNull()
            expect(gateway.parseCallback({})).toBeNull()
        })
    })

    describe('verify', () => {
        it('rejects non-numeric or non-positive trackId before calling Zibal', async () => {
            await expect(
                gateway.verify('not-a-number'),
            ).rejects.toMatchObject({
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'verify',
                },
            })

            await expect(
                gateway.verify('0'),
            ).rejects.toMatchObject({
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'verify',
                },
            })

            expect(requests).toHaveLength(0)
        })

        it('maps result 100/201 to paid verification and converts amount back using multiplier', async () => {
            const paidAtIso = '2026-11-24T08:00:00.000Z'
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(
                    JSON.stringify({
                        result: 201,
                        amount: 15000,
                        refNumber: 998877,
                        cardNumber: '603799******1111',
                        paidAt: paidAtIso,
                    }),
                )
            }

            const verification = await gateway.verify('555')

            expect(requests[0]).toMatchObject({
                method: 'POST',
                url: '/v1/verify',
                body: {merchant: 'zibal', trackId: 555},
            })
            expect(verification).toEqual({
                status: 'paid',
                amount: 1500,
                trackingCode: '998877',
                cardMask: '603799******1111',
                paidAt: new Date(paidAtIso),
                failureCode: null,
            })
        })

        it('maps result 202 with status -1 or undefined to pending, and other statuses to failed', async () => {
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({result: 202, status: -1}))
            }
            expect(await gateway.verify('123')).toMatchObject({
                status: 'pending',
                amount: null,
                failureCode: null,
            })

            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({result: 202, status: 3}))
            }
            expect(await gateway.verify('123')).toMatchObject({
                status: 'failed',
                amount: null,
                failureCode: 'status_3',
            })
        })

        it('maps result 203 to failed with invalid_reference', async () => {
            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify({result: 203}))
            }

            await expect(gateway.verify('123')).resolves.toEqual({
                status: 'failed',
                amount: null,
                trackingCode: null,
                cardMask: null,
                paidAt: null,
                failureCode: 'invalid_reference',
            })
        })

        it('throws PaymentGatewayError on HTTP errors, invalid JSON, or network failure', async () => {
            nextHandler = (_req, res) => {
                res.writeHead(502, {'Content-Type': 'text/plain'})
                res.end('Bad Gateway')
            }
            await expect(
                gateway.verify('123'),
            ).rejects.toMatchObject({
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'verify',
                    code: 'http_502',
                },
            })

            nextHandler = (_req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end('{not-valid-json')
            }
            await expect(
                gateway.verify('123'),
            ).rejects.toMatchObject({
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'verify',
                    code: 'invalid_json',
                },
            })

            nextHandler = (_req, res) => {
                res.destroy()
            }
            await expect(gateway.verify('123')).rejects.toMatchObject({
                code: 'PAYMENT_GATEWAY_FAILED',
                details: {
                    gateway: 'zibal',
                    stage: 'verify',
                    code: 'unreachable',
                },
            })
        })
    })
})