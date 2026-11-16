import {
  IOrderRepository, Order, OrderCouponInvalidError, OrderLine, orderLineTotal,
  OrderPriceChangedError, OrderRecipientIncompleteError, OrderVersionConflictError, Recipient,
} from '@api/order/domain'
import { ConfigProvider } from '@common/configuration'
import { NonOperationalError } from '@common/errors'
import { ILogger } from '@common/logger'

import { IPlaceOrder, PlaceOrderCommand } from '../../interfaces'
import {
  ICartGateway, IOrderPromotions, IShippingCalculator, IShippingDetailsProvider,
  IVariantRefProvider, PromotionResult, ShippingDetails,
} from '../../ports'

export default class PlaceOrderUseCase implements IPlaceOrder {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly cart: ICartGateway,
    private readonly promotions: IOrderPromotions,
    private readonly variantRefs: IVariantRefProvider,
    private readonly shippingDetails: IShippingDetailsProvider,
    private readonly shippingCalculator: IShippingCalculator,
    private readonly config: ConfigProvider,
    private readonly logger: ILogger,
  ) {}

  async execute(command: PlaceOrderCommand, userId: string): Promise<Order> {
    const replay = await this.orders.findByIdempotencyKey(userId, command.idempotencyKey)
    if (replay) return replay

    const checkout = await this.cart.getCheckout(userId)
    const details = await this.shippingDetails.get(userId, command.addressId)
    const recipient = this.completeRecipient(details.recipient)

    const priced = await this.promotions.price({
      userId,
      couponCode: checkout.couponCode,
      lines: checkout.lines.map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        categoryId: l.categoryId,
        brandId: l.brandId,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      })),
    })
    if (priced.coupon.status === 'invalid') throw new OrderCouponInvalidError(priced.coupon.reason)

    const refs = new Map(
      (await this.variantRefs.findByIds(checkout.lines.map((l) => l.variantId))).map((r) => [r.id, r]),
    )
    const prices = new Map(priced.lines.map((l) => [l.variantId, l]))

    const lines: OrderLine[] = checkout.lines.map((line) => {
      const ref = refs.get(line.variantId)
      const price = prices.get(line.variantId)
      if (!ref || !price) {
        throw new NonOperationalError({ details: { variantId: line.variantId, ref: !!ref, price: !!price } })
      }
      return {
        variantId: line.variantId,
        productId: line.productId,
        productName: line.productName,
        productSlug: line.productSlug,
        imageKey: line.imageKey,
        sku: ref.sku,
        externalSource: ref.source,
        externalId: ref.externalId,
        attributes: line.attributes,
        quantity: line.quantity,
        originalUnitPrice: price.originalUnitPrice,
        unitPrice: price.unitPrice,
        couponAllocation: price.couponAllocation,
      }
    })

    const afterDiscounts = lines.reduce((sum, l) => sum + orderLineTotal(l), 0)
    const shippingFee = await this.shippingCalculator.calculate({
      subtotalAfterDiscounts: afterDiscounts,
      province: details.address.province,
    })

    const order = Order.place({
      userId,
      idempotencyKey: command.idempotencyKey,
      lines,
      coupon:
        priced.coupon.status === 'applied'
          ? { couponId: priced.coupon.couponId, code: priced.coupon.code }
          : null,
      shippingFee,
      currency: this.config.getOptional('SHOP_CURRENCY') ?? 'IRR',
      shippingAddress: details.address,
      recipient,
    })

    if (command.expectedTotal !== undefined && command.expectedTotal !== order.total) {
      throw new OrderPriceChangedError(command.expectedTotal, order.total)
    }

    return this.persist(order, priced.coupon, userId)
  }

  private async persist(
    order: Order,
    coupon: PromotionResult['coupon'],
    userId: string,
  ): Promise<Order> {
    if (coupon.status === 'applied') {
      await this.promotions.reserveCoupon({
        couponId: coupon.couponId,
        userId,
        orderId: order.id,
        discountAmount: coupon.discount,
      })
    }

    let orderNumber: number | null
    try {
      orderNumber = await this.orders.create(order)
    } catch (error) {
      await this.releaseQuietly(order.id)
      throw error
    }

    if (orderNumber === null) {
      await this.releaseQuietly(order.id)
      const existing = await this.orders.findByIdempotencyKey(userId, order.idempotencyKey)
      if (existing) return existing
      throw new OrderVersionConflictError()
    }

    order.assignNumber(orderNumber)

    void this.logger.info('Order placed', {
      module: 'PlaceOrderUseCase',
      operation: 'execute',
      event: 'order.place',
      userId,
      resourceId: order.id,
      data: { orderNumber, itemCount: order.itemCount, total: order.total, currency: order.currency },
    })
    return order
  }

  private completeRecipient(r: ShippingDetails['recipient']): Recipient {
    const missing = [
      !r.firstName?.trim() ? 'firstName' : null,
      !r.lastName?.trim() ? 'lastName' : null,
      !r.phoneNumber ? 'phoneNumber' : null,
    ].filter((m): m is string => m !== null)

    if (missing.length > 0 || !r.phoneNumber) throw new OrderRecipientIncompleteError(missing)
    return { firstName: r.firstName, lastName: r.lastName, phoneNumber: r.phoneNumber }
  }

  private async releaseQuietly(orderId: string): Promise<void> {
    try {
      await this.promotions.releaseCoupon(orderId)
    } catch (error) {
      void this.logger.warn('Coupon reservation could not be released', {
        module: 'PlaceOrderUseCase',
        operation: 'releaseQuietly',
        event: 'order.coupon.release',
        resourceId: orderId,
        err: error,
      })
    }
  }
}
