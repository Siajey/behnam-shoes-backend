import {ListQuery} from '@common/dto'

import {Order, OrderStatus} from '../entities'

export interface AdminOrderListCriteria extends ListQuery<never> {
    statuses?: OrderStatus[]
    from?: Date
    to?: Date
    orderNumber?: number
}

export interface OrderPage {
    orders: Order[]
    nextCursor: string | null
}
export interface ProductUnitsSold {
    productId: string
    unitsSold: number
}

export interface IOrderRepository {
    findById(id: string): Promise<Order | null>

    findByIdempotencyKey(userId: string, key: string): Promise<Order | null>

    create(order: Order): Promise<number | null>

    save(order: Order): Promise<void>

    listByUser(userId: string, criteria: ListQuery<never>): Promise<OrderPage>

    listAll(criteria: AdminOrderListCriteria): Promise<OrderPage>

    findExpirable(now: Date, limit: number): Promise<Order[]>

    unitsSoldByProduct(since: Date): Promise<ProductUnitsSold[]>

    findShippedByIds(ids: string[]): Promise<Order[]>

    hasPurchasedProduct(userId: string, productId: string): Promise<boolean>
}
