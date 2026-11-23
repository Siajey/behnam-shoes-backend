export const createPaymentDescription = (orderNumber: number | null) => {
    return `سفارش شماره ${orderNumber ?? ''}`.trim()
}