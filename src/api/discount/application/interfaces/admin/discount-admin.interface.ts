import { Discount, DiscountKind, DiscountListCriteria, DiscountPage, DiscountScope } from '@api/discount/domain'

export interface CreateDiscountCommand {
    name: string
    kind: DiscountKind
    value: number
    maxDiscountPerUnit?: number | null
    scope: DiscountScope
    startsAt?: Date | null
    endsAt?: Date | null
    isActive?: boolean
}

export interface EditDiscountCommand {
    id: string
    name?: string
    kind?: DiscountKind
    value?: number
    maxDiscountPerUnit?: number | null
    scope?: DiscountScope
    startsAt?: Date | null
    endsAt?: Date | null
    isActive?: boolean
}

export interface IListDiscounts {
    execute(query: DiscountListCriteria): Promise<DiscountPage>
}
export interface IGetDiscount {
    execute(id: string): Promise<Discount>
}
export interface ICreateDiscount {
    execute(command: CreateDiscountCommand, actorId: string): Promise<Discount>
}
export interface IEditDiscount {
    execute(command: EditDiscountCommand, actorId: string): Promise<Discount>
}
export interface IDeleteDiscount {
    execute(id: string, actorId: string): Promise<void>
}