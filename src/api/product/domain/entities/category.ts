import { randomUUID } from 'node:crypto'

import { CategoryCircularParentError } from '../errors'

export interface CategoryProps {
    id: string
    name: string
    slug: string
    parentId: string | null
    sortOrder: number
    createdAt: Date
    updatedAt: Date
}

export class Category {
    private constructor(private props: CategoryProps) {}

    static create(input: {
        name: string
        slug: string
        parentId?: string | null
        sortOrder?: number
    }): Category {
        const now = new Date()
        return new Category({
            id: randomUUID(),
            name: input.name,
            slug: input.slug,
            parentId: input.parentId ?? null,
            sortOrder: input.sortOrder ?? 0,
            createdAt: now,
            updatedAt: now,
        })
    }

    static restore(props: CategoryProps): Category {
        return new Category(props)
    }

    get id() { return this.props.id }
    get name() { return this.props.name }
    get slug() { return this.props.slug }
    get parentId() { return this.props.parentId }
    get sortOrder() { return this.props.sortOrder }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    update(input: { name?: string; slug?: string; sortOrder?: number }): void {
        if (input.name !== undefined) this.props.name = input.name
        if (input.slug !== undefined) this.props.slug = input.slug
        if (input.sortOrder !== undefined) this.props.sortOrder = input.sortOrder
        this.props.updatedAt = new Date()
    }

    moveTo(newParentId: string | null, all: readonly Category[]): void {
        if (newParentId !== null) {
            const byId = new Map(all.map((c) => [c.id, c]))
            let cursor: string | null = newParentId
            while (cursor !== null) {
                if (cursor === this.id) throw new CategoryCircularParentError()
                cursor = byId.get(cursor)?.parentId ?? null
            }
        }
        this.props.parentId = newParentId
        this.props.updatedAt = new Date()
    }
}