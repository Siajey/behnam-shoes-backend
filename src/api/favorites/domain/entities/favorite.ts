import { randomUUID } from 'node:crypto'

export const MAX_FAVORITES = 200

export interface FavoriteProps {
    id: string
    userId: string
    productId: string
    createdAt: Date
}

export class Favorite {
    private constructor(private readonly props: FavoriteProps) {}

    static create(userId: string, productId: string, createdAt: Date = new Date()): Favorite {
        return new Favorite({ id: randomUUID(), userId, productId, createdAt })
    }

    static restore(props: FavoriteProps): Favorite {
        return new Favorite(props)
    }

    get id() { return this.props.id }
    get userId() { return this.props.userId }
    get productId() { return this.props.productId }
    get createdAt() { return this.props.createdAt }
}

export const remainingFavoriteCapacity = (currentCount: number): number =>
    Math.max(0, MAX_FAVORITES - currentCount)