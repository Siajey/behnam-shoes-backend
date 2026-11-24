import {createInterface} from 'node:readline/promises'
import {stdin, stdout} from 'node:process'

import {beforeAll, describe, expect, it,} from '@jest/globals'

import {ConfigProvider} from '@common/configuration'
import {ZibalGateway} from '@api/payment/infrastructure/gateways'

const ENABLE_LIVE_TEST = process.env.ZIBAL_LIVE_TEST === '1'

const BASE_URL = 'https://gateway.zibal.ir'
const MERCHANT = 'zibal'
const AMOUNT_MULTIPLIER = 10

const sandboxDescribe = ENABLE_LIVE_TEST ? describe : describe.skip

sandboxDescribe('Zibal Sandbox (real HTTP)', () => {
    let gateway: ZibalGateway

    const amountToman = Number(100000)
    const callbackUrl = 'https://api.example.com'

    const configValues: Record<string, string | undefined> = {
        ZIBAL_MERCHANT: MERCHANT,
        ZIBAL_BASE_URL: BASE_URL,
        ZIBAL_AMOUNT_MULTIPLIER: String(AMOUNT_MULTIPLIER),
    }

    const config: ConfigProvider = {
        get: (key: string) => {
            const value = configValues[key]

            if (value === undefined) {
                throw new Error(`Missing config key: ${key}`)
            }

            return value
        },
        getOptional: (key: string) => configValues[key],
    } as unknown as ConfigProvider

    beforeAll(() => {
        if (!callbackUrl) {
            throw new Error('ZIBAL_TEST_CALLBACK_URL is required.')
        }

        const parsedCallback = new URL(callbackUrl)

        if (parsedCallback.protocol !== 'https:') {
            throw new Error('ZIBAL_TEST_CALLBACK_URL must use HTTPS.')
        }

        gateway = new ZibalGateway(config)
    })

    it(
        'creates a sandbox payment and verifies the completed transaction',
        async () => {
            const paymentId = `zibal-test-${Date.now()}`

            // 1. Request payment through the real Zibal API.
            const target = await gateway.requestPayment({
                paymentId,
                amount: amountToman,
                callbackUrl: callbackUrl!,
                description: 'Behnam Shoes - Zibal sandbox test',
            })

            expect(target.reference).toMatch(/^\d+$/)

            const trackId = target.reference

            expect(target.redirectUrl).toBe(
                `${BASE_URL}/start/${trackId}`,
            )

            console.log('\n======================================')
            console.log('ZIBAL SANDBOX PAYMENT CREATED')
            console.log('======================================')
            console.log(`Payment ID: ${paymentId}`)
            console.log(`Track ID:   ${trackId}`)
            console.log(`Amount:     ${amountToman} Toman`)
            console.log(`Amount sent to Zibal: ${amountToman * AMOUNT_MULTIPLIER} Rial`)
            console.log(`Payment URL: ${target.redirectUrl}`)
            console.log('======================================\n')

            // 2. Wait for manual payment.
            const readline = createInterface({
                input: stdin,
                output: stdout,
            })

            try {
                await readline.question(
                    'Complete the payment in your browser, then press ENTER...',
                )
            } finally {
                readline.close()
            }

            // 3. Verify against the real Zibal API.
            const verification = await gateway.verify(trackId)

            console.log('\nZIBAL VERIFICATION')
            console.dir(verification, {depth: null})

            // 4. Assert the normalized gateway response.
            expect(verification).toMatchObject({
                status: 'paid',
                amount: amountToman,
                failureCode: null,
            })

            expect(verification.paidAt).toBeInstanceOf(Date)
            expect(Number.isNaN(verification.paidAt!.getTime())).toBe(false)

            console.log('\nSandbox transaction verified successfully.')
        },
        10 * 60 * 1000,
    )
})