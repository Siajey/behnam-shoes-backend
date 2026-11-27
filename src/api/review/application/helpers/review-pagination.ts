import {InvalidReviewError, Review, ReviewPageRow} from '@api/review/domain'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/

export function decodeReviewCursor(raw: string | undefined): { createdAt: string; id: string } | null {
    if (!raw) return null
    const [createdAt, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
    if (!id || !UUID.test(id) || !createdAt || !TIMESTAMP.test(createdAt)) throw new InvalidReviewError('cursor')
    return { createdAt, id }
}

export function toPage(rows: ReviewPageRow[], pageSize: number): { reviews: Review[]; nextCursor: string | null } {
    const page = rows.slice(0, pageSize)
    const last = page[page.length - 1]
    const nextCursor =
        rows.length > pageSize && last
            ? Buffer.from(`${last.createdAtRaw}|${last.review.id}`).toString('base64url')
            : null
    return { reviews: page.map((r) => r.review), nextCursor }
}