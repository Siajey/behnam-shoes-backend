import {randomUUID} from 'node:crypto'

export interface BrandProps {
    id: string
    name: string
    slug: string
    logoKey: string | null
    imageKey?: string | null
    createdAt: Date
    updatedAt: Date
}

export class Brand {
    private constructor(private props: BrandProps) {
    }

    static create(input: { name: string; slug: string; logoKey?: string | null; imageKey?: string | null }): Brand {
        const now = new Date()
        return new Brand({
            id: randomUUID(),
            name: input.name,
            slug: input.slug,
            logoKey: input.logoKey ?? null,
            imageKey: input.imageKey ?? null,
            createdAt: now,
            updatedAt: now,
        })
    }

    static restore(props: BrandProps): Brand {
        return new Brand(props)
    }

    get id() {
        return this.props.id
    }

    get name() {
        return this.props.name
    }

    get slug() {
        return this.props.slug
    }

    get logoKey() {
        return this.props.logoKey
    }

    get imageKey() {
        return this.props.imageKey
    }

    get createdAt() {
        return this.props.createdAt
    }

    get updatedAt() {
        return this.props.updatedAt
    }

    update(input: { name?: string; slug?: string; logoKey?: string | null; imageKey?: string | null }): void {
        if (input.name !== undefined) this.props.name = input.name
        if (input.slug !== undefined) this.props.slug = input.slug
        if (input.logoKey !== undefined) this.props.logoKey = input.logoKey
        if (input.imageKey !== undefined) this.props.imageKey = input.imageKey
        this.props.updatedAt = new Date()
    }
}