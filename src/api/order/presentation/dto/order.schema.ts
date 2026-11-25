import { z } from 'zod'

import { ORDER_STATUSES } from '@api/order/domain'
import {
  cursorSchema, dateSchema, pageSizeSchema, requiredText, uuidSchema,
} from '@common/validations'

const invalid = { error: 'errors.validation.invalidFieldValue' }


export const IdempotencyKeySchema = z
  .string({ error: 'errors.validation.requiredField' })
  .trim()
  .min(8, { error: 'errors.validation.minLengthString' })
  .max(100, { error: 'errors.validation.maxLengthString' })

export const PlaceOrderSchema = z.object({
    addressId: uuidSchema,
    shippingMethod: z.string().trim().regex(/^[a-z][a-z0-9_]{1,29}$/, invalid),
    expectedTotal: z.number(invalid).int(invalid).min(0, invalid).optional(),
})

export type PlaceOrderBody = z.infer<typeof PlaceOrderSchema>

export const ListMyOrdersQuerySchema = z.object({
  pageSize: pageSizeSchema.optional(),
  nextCursor: cursorSchema.optional(),
})
export type ListMyOrdersQuery = z.infer<typeof ListMyOrdersQuerySchema>

export const AdminListOrdersQuerySchema = ListMyOrdersQuerySchema.extend({
  statuses: z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(ORDER_STATUSES, invalid)).max(ORDER_STATUSES.length, invalid))
    .optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  orderNumber: z.coerce.number(invalid).int(invalid).min(1, invalid).optional(),
})
export type AdminListOrdersQuery = z.infer<typeof AdminListOrdersQuerySchema>

const note = requiredText(500).nullish()
const trackingCode = z.string().trim().min(1, invalid).max(100, invalid)

export const UpdateOrderStatusSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('startProcessing', invalid), note }),
  z.object({
    action: z.literal('ship', invalid),
    carrier: requiredText(100).nullish(),
    trackingCode: trackingCode.nullish(),
    note,
  }),
  z.object({ action: z.literal('deliver', invalid), note }),
  z.object({ action: z.literal('cancel', invalid), note }),
])
export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusSchema>
