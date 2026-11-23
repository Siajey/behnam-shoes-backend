import {Controller, Get, Inject, Param} from '@nestjs/common'

import {IListOrderPayments} from '@api/payment/application'
import {SuccessResponse} from '@common/api'
import {AdminOnly} from '@common/decorator'
import {LIST_ORDER_PAYMENTS} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {PaymentPresenter} from '../presenters'

@Controller('admin/orders')
export default class AdminPaymentController {
    constructor(@Inject(LIST_ORDER_PAYMENTS) private readonly listPayments: IListOrderPayments) {
    }

    @AdminOnly()
    @Get(':id/payments')
    async listController(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
        const payments = await this.listPayments.execute(id)
        return new SuccessResponse({
            messageObj: {message: 'common.payment.listSuccess'},
            code: 'PAYMENT_LIST_SUCCESS',
            path: `/admin/orders/${id}/payments`,
            data: {
                items: payments.map(PaymentPresenter.admin)
            }
        })
    }
}
