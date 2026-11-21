import {OrderStatus} from '@api/order/domain'

export interface OrderPaymentInfo {
    orderId: string
    orderNumber: number | null
    userId: string
    amount: number
    currency: string
    status: OrderStatus
    canPay: boolean
}

export interface ProductSales {
    productId: string;
    unitsSold: number
}


export interface IExpireUnpaidOrders {
    execute(): Promise<{ expired: number }>
}

export interface IGetOrderPaymentInfo {
    execute(orderId: string): Promise<OrderPaymentInfo>
}

export interface IGetPayableOrder {
    execute(orderId: string, userId: string): Promise<OrderPaymentInfo>
}

export interface IMarkOrderPaid {
    execute(orderId: string): Promise<void>
}

export interface IGetProductSales {
    execute(since: Date): Promise<ProductSales[]>
}