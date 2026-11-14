import { randomUUID } from 'node:crypto'

import { InvalidDiscountError } from '../errors'
import {
    discountAmount, DiscountKind, DiscountScope, isValidCap, isValidDiscountValue, isValidPeriod,
    isValidScope, isWithinPeriod, normalizeScope, PricingLine, scopeMatches,
} from '../value-objects'

export interface DiscountInput {
    name: string
    kind: DiscountKind
    value: number
    maxDiscountPerUnit: number | null
    scope: DiscountScope
    startsAt: Date | null
    endsAt: Date | null
    isActive: boolean
}

export interface DiscountProps extends DiscountInput {
    id: string
    createdAt: Date
    updatedAt: Date
}

export class Discount {
    private constructor(private props: DiscountProps) {}

    static create(
        input: Pick<DiscountInput, 'name' | 'kind' | 'value' | 'scope'> & Partial<DiscountInput>,
    ): Discount {
        const now = new Date()
        const data = Discount.validated({
            name: input.name,
            kind: input.kind,
            value: input.value,
            scope: input.scope,
            maxDiscountPerUnit: input.maxDiscountPerUnit ?? null,
            startsAt: input.startsAt ?? null,
            endsAt: input.endsAt ?? null,
            isActive: input.isActive ?? true,
        })
        return new Discount({ id: randomUUID(), ...data, createdAt: now, updatedAt: now })
    }

    static restore(props: DiscountProps): Discount {
        return new Discount(props)
    }

    private static validated(data: DiscountInput): DiscountInput {
        const scope = normalizeScope(data.scope)
        if (!isValidDiscountValue(data.kind, data.value)) throw new InvalidDiscountError('value')
        if (!isValidCap(data.maxDiscountPerUnit)) throw new InvalidDiscountError('cap')
        if (!isValidScope(scope)) throw new InvalidDiscountError('scope')
        if (!isValidPeriod(data.startsAt, data.endsAt)) throw new InvalidDiscountError('period')
        return { ...data, scope }
    }

    get id() { return this.props.id }
    get name() { return this.props.name }
    get kind() { return this.props.kind }
    get value() { return this.props.value }
    get maxDiscountPerUnit() { return this.props.maxDiscountPerUnit }
    get scope(): DiscountScope { return this.props.scope }
    get startsAt() { return this.props.startsAt }
    get endsAt() { return this.props.endsAt }
    get isActive() { return this.props.isActive }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    update(changes: Partial<DiscountInput>): void {
        const defined = Object.fromEntries(
            Object.entries(changes).filter(([, v]) => v !== undefined),
        ) as Partial<DiscountInput>

        const data = Discount.validated({
            name: this.props.name,
            kind: this.props.kind,
            value: this.props.value,
            maxDiscountPerUnit: this.props.maxDiscountPerUnit,
            scope: this.props.scope,
            startsAt: this.props.startsAt,
            endsAt: this.props.endsAt,
            isActive: this.props.isActive,
            ...defined,
        })
        Object.assign(this.props, data, { updatedAt: new Date() })
    }

    isActiveAt(now: Date): boolean {
        return this.props.isActive && isWithinPeriod(now, this.props.startsAt, this.props.endsAt)
    }

    appliesTo(line: PricingLine): boolean {
        return scopeMatches(this.props.scope, line)
    }

    discountPerUnit(unitPrice: number): number {
        const raw = discountAmount(this.props.kind, this.props.value, unitPrice)
        return this.props.maxDiscountPerUnit === null ? raw : Math.min(raw, this.props.maxDiscountPerUnit)
    }
}