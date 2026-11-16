import { Order } from '@api/order/domain'

import { OrderPaymentInfo } from '../interfaces/system'

export const toPaymentInfo = (order: Order, now: Date): OrderPaymentInfo => ({
  orderId: order.id,
  orderNumber: order.orderNumber,
  userId: order.userId,
  amount: order.total,
  currency: order.currency,
  status: order.status,
  canPay: order.canPay(now),
})
