import {Body, Controller, Get, HttpStatus, Inject, Param, Post, Query, Res, UseGuards} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'
import type {FastifyReply} from 'fastify'

import {IGetPaymentStatus, IHandlePaymentCallback, IStartPayment} from '@api/payment/application'
import {PaymentGatewayNotSupportedError, PaymentNotFoundError} from '@api/payment/domain'
import {CSRFGuard, JwtSessionGuard} from '@api/session/presentation'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {ConfigProvider} from '@common/configuration'
import {ReqUser} from '@common/decorator'
import {CONFIG_PROVIDER, GET_PAYMENT_STATUS, HANDLE_PAYMENT_CALLBACK, START_PAYMENT} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {gatewayNameSchema, StartPaymentBody, StartPaymentSchema} from '../dto'
import {PaymentPresenter} from '../presenters'

const isProd = process.env.NODE_ENV === 'production'
const CALLBACK_THROTTLE = {default: {ttl: 60_000, limit: isProd ? 60 : 10_000}}
const USER_THROTTLE = {default: {ttl: 60_000, limit: isProd ? 30 : 10_000}}
const gatewayPipe = new ZodValidationPipe(gatewayNameSchema)
const toStringMap = (raw: Record<string, unknown>): Record<string, string> => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')]))

@Controller('payments')
export default class PaymentController {
    constructor(
        @Inject(START_PAYMENT) private readonly startPayment: IStartPayment,
        @Inject(GET_PAYMENT_STATUS) private readonly getStatus: IGetPaymentStatus,
        @Inject(HANDLE_PAYMENT_CALLBACK) private readonly handleCallback: IHandlePaymentCallback,
        @Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {
    }

    @Post() @UseGuards(CSRFGuard, JwtSessionGuard) @Throttle(USER_THROTTLE)
    async startController(@Body(new ZodValidationPipe(StartPaymentSchema)) body: StartPaymentBody, @ReqUser() user: User) {
        const result = await this.startPayment.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.payment.startSuccess'},
            code: 'PAYMENT_START_SUCCESS',
            path: '/payments',
            status: HttpStatus.CREATED,
            data: result
        })
    }

    @Get('callback/:gateway') @Throttle(CALLBACK_THROTTLE)
    callbackGet(@Param('gateway', gatewayPipe) gateway: string, @Query() query: Record<string, unknown>, @Res() reply: FastifyReply) {
        return this.finishCallback(gateway, toStringMap(query), reply)
    }

    @Post('callback/:gateway') @Throttle(CALLBACK_THROTTLE)
    callbackPost(@Param('gateway', gatewayPipe) gateway: string, @Body() body: Record<string, unknown>, @Res() reply: FastifyReply) {
        return this.finishCallback(gateway, toStringMap(body ?? {}), reply)
    }

    @Get(':id') @UseGuards(JwtSessionGuard) @Throttle(USER_THROTTLE)
    async statusController(@Param('id', new ZodValidationPipe(uuidSchema)) id: string, @ReqUser() user: User) {
        const payment = await this.getStatus.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.payment.getSuccess'},
            code: 'PAYMENT_GET_SUCCESS',
            path: `/payments/${id}`,
            data: PaymentPresenter.status(payment)
        })
    }

    private async finishCallback(gateway: string, params: Record<string, string>, reply: FastifyReply) {
        try {
            const outcome = await this.handleCallback.execute({gateway, params})
            return reply.redirect(this.resultUrl({
                status: outcome.status === 'paid' ? 'paid' : outcome.status === 'redirected' ? 'pending' : 'failed',
                orderId: outcome.orderId,
                paymentId: outcome.paymentId
            }))
        } catch (error) {
            if (error instanceof PaymentNotFoundError || error instanceof PaymentGatewayNotSupportedError) return reply.redirect(this.resultUrl({status: 'invalid'}))
            throw error
        }
    }

    private resultUrl(params: Record<string, string>): string {
        const url = new URL(this.config.get('PAYMENT_RESULT_URL'));
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        return url.toString()
    }
}
