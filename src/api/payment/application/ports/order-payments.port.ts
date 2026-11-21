export interface PayableOrder {
    orderId: string;
    orderNumber: number | null;
    amount: number;
    currency: string
}

export interface IOrderPayments {
    getPayable(orderId: string, userId: string): Promise<PayableOrder>

    markPaid(orderId: string): Promise<void>
}
