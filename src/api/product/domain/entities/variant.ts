import {randomUUID} from 'node:crypto'

import {InvalidVariantPriceError, InvalidVariantStockError} from '../errors'
import {normalizeAttributes} from "@common/util";

export interface VariantAttribute {
    name: string
    value: string
}

export interface ExternalVariantSnapshot {
    sku: string
    price: number
    stock: number
    isActive: boolean
    attributes: VariantAttribute[]
}

export interface VariantProps extends ExternalVariantSnapshot {
    id: string
    source: string
    externalId: string
    productId: string | null
    createdAt: Date
    updatedAt: Date
}

export class Variant {
    private constructor(private props: VariantProps) {
    }

    static restore(props: VariantProps): Variant {
        return new Variant(props)
    }

    private static assertSnapshot(s: ExternalVariantSnapshot): void {
        if (!Number.isInteger(s.price) || s.price < 0) throw new InvalidVariantPriceError()
        if (!Number.isInteger(s.stock) || s.stock < 0) throw new InvalidVariantStockError()
    }

    static createFromExternal(source: string, externalId: string, snapshot: VariantProps) {
        Variant.assertSnapshot(snapshot)
        const now = new Date()
        return new Variant({
            ...snapshot,
            attributes: normalizeAttributes(snapshot.attributes),
            id: randomUUID(),
            source,
            externalId,
            productId: null,
            createdAt: now,
            updatedAt: now,
        })
    }

    applySnapshot(snapshot: ExternalVariantSnapshot): void {
        Variant.assertSnapshot(snapshot)
        Object.assign(this.props, snapshot, {
            attributes: normalizeAttributes(snapshot.attributes),
            updatedAt: new Date(),
        })
    }

    attribute(name: string): string | undefined {
        return this.props.attributes.find((a) => a.name === name)?.value
    }

    get id() {
        return this.props.id
    }

    get source() {
        return this.props.source
    }

    get externalId() {
        return this.props.externalId
    }

    get sku() {
        return this.props.sku
    }

    get price() {
        return this.props.price
    }

    get stock() {
        return this.props.stock
    }

    get isActive() {
        return this.props.isActive
    }

    get attributes(): readonly VariantAttribute[] {
        return this.props.attributes
    }

    get productId() {
        return this.props.productId
    }

    get createdAt() {
        return this.props.createdAt
    }

    get updatedAt() {
        return this.props.updatedAt
    }

    get isAvailable(): boolean {
        return this.props.isActive && this.props.stock > 0
    }

    get isAssigned(): boolean {
        return this.props.productId !== null
    }

    deactivate(): void {
        this.props.isActive = false
        this.props.updatedAt = new Date()
    }

    assignTo(productId: string): void {
        this.props.productId = productId
        this.props.updatedAt = new Date()
    }

    unassign(): void {
        this.props.productId = null
        this.props.updatedAt = new Date()
    }
}