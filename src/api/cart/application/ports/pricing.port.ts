import {PricingResult} from "@api/cart/domain";

export interface PricingRequestLine {
    variantId: string
    productId: string
    categoryId: string | null
    brandId: string | null
    unitPrice: number
    quantity: number
}

export interface PricingRequest {
    userId: string
    lines: PricingRequestLine[]
    couponCode: string | null
}

export interface IPricingService {
    price(request: PricingRequest): Promise<PricingResult>
}