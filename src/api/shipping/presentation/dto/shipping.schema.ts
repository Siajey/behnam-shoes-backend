import { isNonEmptyBody, requiredText, uuidSchema } from '@common/validations'
import { z } from 'zod'

const invalid = { error: 'errors.validation.invalidFieldValue' }
const slug = z.string().trim().regex(/^[a-z][a-z0-9_]{1,29}$/, invalid)
const fee = z.number(invalid).int(invalid).min(0, invalid)

export const ShippingOptionsQuerySchema = z.object({ addressId: uuidSchema })
export type ShippingOptionsQuery = z.infer<typeof ShippingOptionsQuerySchema>

export const CreateShippingMethodSchema = z.object({
  code: slug,
  name: requiredText(60),
  description: requiredText(200).nullish(),
  carrier: slug,
  service: z.string().trim().min(1, invalid).max(50, invalid),
  isActive: z.boolean(invalid).optional(),
  position: z.number(invalid).int(invalid).min(0, invalid).optional(),
  fallbackFee: fee.nullish(),
  freeThreshold: z.number(invalid).int(invalid).min(1, invalid).nullish(),
  handlingFee: fee.optional(),
})
export type CreateShippingMethodBody = z.infer<typeof CreateShippingMethodSchema>

export const EditShippingMethodSchema = z
  .object({
    name: requiredText(60).optional(),
    description: requiredText(200).nullable().optional(),
    carrier: slug.optional(),
    service: z.string().trim().min(1, invalid).max(50, invalid).optional(),
    isActive: z.boolean(invalid).optional(),
    position: z.number(invalid).int(invalid).min(0, invalid).optional(),
    fallbackFee: fee.nullable().optional(),
    freeThreshold: z.number(invalid).int(invalid).min(1, invalid).nullable().optional(),
    handlingFee: fee.optional(),
  })
  .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type EditShippingMethodBody = z.infer<typeof EditShippingMethodSchema>
