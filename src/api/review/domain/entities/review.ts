import { randomUUID } from 'node:crypto'

import { normalizePersianLetters } from '@common/util'

import { InvalidReviewError } from '../errors'

export interface ReviewReply {
  text: string
  repliedAt: Date
  repliedBy: string
}

export interface ReviewProps {
  id: string
  productId: string
  userId: string
  rating: number
  comment: string | null
  displayName: string | null
  isVerifiedPurchase: boolean
  reply: ReviewReply | null
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateReviewInput {
  productId: string
  userId: string
  rating: number
  comment?: string | null
  displayName?: string | null
  isVerifiedPurchase: boolean
}

const cleaned = (value: string | null | undefined, max: number, reason: string): string | null => {
  const text = normalizePersianLetters((value ?? '').trim())
  if (text.length === 0) return null
  if (text.length > max) throw new InvalidReviewError(reason)
  return text
}

const validRating = (rating: number): number => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new InvalidReviewError('rating')
  return rating
}

export class Review {
  private constructor(private props: ReviewProps) {}

  static create(input: CreateReviewInput): Review {
    const now = new Date()
    return new Review({
      id: randomUUID(),
      productId: input.productId,
      userId: input.userId,
      rating: validRating(input.rating),
      comment: cleaned(input.comment, 2000, 'comment'),
      displayName: cleaned(input.displayName, 40, 'displayName'),
      isVerifiedPurchase: input.isVerifiedPurchase,
      reply: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: ReviewProps): Review {
    return new Review(props)
  }

  get id() { return this.props.id }
  get productId() { return this.props.productId }
  get userId() { return this.props.userId }
  get rating() { return this.props.rating }
  get comment() { return this.props.comment }
  get displayName() { return this.props.displayName }
  get isVerifiedPurchase() { return this.props.isVerifiedPurchase }
  get reply() { return this.props.reply }
  get version() { return this.props.version }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  edit(changes: { rating?: number; comment?: string | null; displayName?: string | null }): boolean {
    const ratingChanged = changes.rating !== undefined && changes.rating !== this.props.rating

    if (changes.rating !== undefined) this.props.rating = validRating(changes.rating)
    if (changes.comment !== undefined) this.props.comment = cleaned(changes.comment, 2000, 'comment')
    if (changes.displayName !== undefined) this.props.displayName = cleaned(changes.displayName, 40, 'displayName')
    this.props.updatedAt = new Date()
    return ratingChanged
  }

  answer(text: string, adminId: string): void {
    const reply = cleaned(text, 1000, 'reply')
    if (!reply) throw new InvalidReviewError('reply')
    const now = new Date()
    this.props.reply = { text: reply, repliedAt: now, repliedBy: adminId }
    this.props.updatedAt = now
  }

  removeReply(): boolean {
    if (!this.props.reply) return false
    this.props.reply = null
    this.props.updatedAt = new Date()
    return true
  }
}
