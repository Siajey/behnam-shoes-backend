import { Favorite } from '@api/favorites/domain'

export const DEFAULT_FAVORITES_PAGE_SIZE = 20

const encodeCursor = (f: Favorite): string =>
    Buffer.from(`${f.createdAt.toISOString()}|${f.id}`).toString('base64url')

function decodeCursor(cursor: string): { time: number; id: string } | null {
    try {
        const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf-8').split('|')
        const time = new Date(iso).getTime()
        return id && !Number.isNaN(time) ? { time, id } : null
    } catch {
        return null
    }
}

export function paginateFavorites(
    ordered: readonly Favorite[],
    pageSize: number,
    cursor?: string,
): { items: Favorite[]; nextCursor: string | null } {
    const decoded = cursor ? decodeCursor(cursor) : null
    const remaining = decoded
        ? ordered.filter(
            (f) =>
                f.createdAt.getTime() < decoded.time ||
                (f.createdAt.getTime() === decoded.time && f.id < decoded.id),
        )
        : ordered

    const items = remaining.slice(0, pageSize)
    const last = items[items.length - 1]
    return { items, nextCursor: remaining.length > pageSize && last ? encodeCursor(last) : null }
}