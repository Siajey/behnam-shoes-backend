import { Module } from '@nestjs/common'

import { ProductModule } from '@api/product/product.module'
import { DatabaseModule } from '@common/db'
import {
    CART_PRICING_SERVICE,
    CART_REPOSITORY,
    CART_VARIANT_CATALOG,
    CLEAR_CART_AFTER_ORDER,
    GET_CHECKOUT_CART,
} from '@common/di'

import {
    CartRepository,
    CartSystemUseCaseProviders,
    CartUserUseCaseProviders,
    DiscountPricingService,
    ProductVariantCatalog,
} from './infrastructure'
import { CartController } from './presentation'
import {SessionModule} from "@api/session";
import {DiscountModule} from "@api/discount/discount.module";

@Module({
    imports: [DatabaseModule, SessionModule, ProductModule,DiscountModule],
    controllers: [CartController],
    providers: [
        { provide: CART_REPOSITORY, useClass: CartRepository },
        { provide: CART_VARIANT_CATALOG, useClass: ProductVariantCatalog },
        { provide: CART_PRICING_SERVICE, useClass: DiscountPricingService },
        ...CartUserUseCaseProviders,
        ...CartSystemUseCaseProviders,
    ],
    exports: [GET_CHECKOUT_CART, CLEAR_CART_AFTER_ORDER],
})
export class CartModule {}