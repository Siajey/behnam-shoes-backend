import {PurchasableVariant} from "@api/cart/domain";

export interface IVariantCatalog {
    findByIds(variantIds: string[]): Promise<PurchasableVariant[]>
}