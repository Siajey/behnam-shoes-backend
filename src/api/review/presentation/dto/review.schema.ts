import { z } from 'zod'

import { isNonEmptyBody, requiredText, uuidSchema } from '@common/validations'

const invalid = { error: 'errors.validation.invalidFieldValue' }
const rating = z.number(invalid).int(invalid).min(1, invalid).max(5, invalid)

const pagination = {
  pageSize: z.coerce.number(invalid).int(invalid).min(1, invalid).max(50, invalid).default(20),
  nextCursor: z.string().trim().min(1, invalid).max(200, invalid).optional(),
}

export const ProductIdParamSchema = uuidSchema

export const CreateReviewSchema = z.object({
  rating,
  comment: requiredText(2000).optional(),
  displayName: requiredText(40).optional(),
})
export type CreateReviewBody = z.infer<typeof CreateReviewSchema>

export const EditReviewSchema = z
  .object({
    rating: rating.optional(),
    comment: requiredText(2000).nullable().optional(),
    displayName: requiredText(40).nullable().optional(),
  })
  .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type EditReviewBody = z.infer<typeof EditReviewSchema>

export const ListReviewsQuerySchema = z.object({
  ...pagination,
  rating: z.coerce.number(invalid).int(invalid).min(1, invalid).max(5, invalid).optional(),
})
export type ListReviewsQuery = z.infer<typeof ListReviewsQuerySchema>

export const AdminListReviewsQuerySchema = z.object({
  ...pagination,
  productId: uuidSchema.optional(),
  rating: z.coerce.number(invalid).int(invalid).min(1, invalid).max(5, invalid).optional(),
  hasReply: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
})
export type AdminListReviewsQuery = z.infer<typeof AdminListReviewsQuerySchema>

export const ReplyReviewSchema = z.object({ text: requiredText(1000) })
export type ReplyReviewBody = z.infer<typeof ReplyReviewSchema>
