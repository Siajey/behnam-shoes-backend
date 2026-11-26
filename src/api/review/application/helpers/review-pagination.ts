import { InvalidReviewError, Review } from '@api/review/domain'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function decodeReviewCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
  const createdAt = new Date(iso ?? '')
  if (!id || !UUID.test(id) || Number.isNaN(createdAt.getTime())) throw new InvalidReviewError('cursor')
  return { createdAt, id }
}

export function toPage(rows: Review[], pageSize: number): { reviews: Review[]; nextCursor: string | null } {
  const reviews = rows.slice(0, pageSize)
  const last = reviews[reviews.length - 1]
  const nextCursor =
    rows.length > pageSize && last
      ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url')
      : null
  return { reviews, nextCursor }
}
