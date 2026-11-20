import { ATTRIBUTE_TYPES, PRODUCT_TYPES } from '@api/product/domain'
import { isNonEmptyBody, requiredText, uuidSchema } from '@common/validations'
import { z } from 'zod'

const invalid = { error: 'errors.validation.invalidFieldValue' }

const optionValue = z.string().trim().min(1, invalid).max(50, invalid)
const MAX_OPTIONS = 200

const newOption = z.object({ value: optionValue, label: requiredText(100) })
const existingOption = z.object({ id: uuidSchema.optional(), value: optionValue, label: requiredText(100) })

const unit = requiredText(20)
const position = z.number(invalid).int(invalid).min(0, invalid)

export const CreateAttributeSchema = z.object({
  key: z
    .string({ error: 'errors.validation.requiredField' })
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, invalid),
  name: requiredText(100),
  type: z.enum(ATTRIBUTE_TYPES, invalid),
  productType: z.enum(PRODUCT_TYPES, invalid).nullish(),
  unit: unit.nullish(),
  isVisible: z.boolean(invalid).optional(),
  isFilterable: z.boolean(invalid).optional(),
  position: position.optional(),
  options: z.array(newOption).max(MAX_OPTIONS, { error: 'errors.validation.maxItems' }).optional(),
})
export type CreateAttributeBody = z.infer<typeof CreateAttributeSchema>

export const EditAttributeSchema = z
  .object({
    name: requiredText(100).optional(),
    productType: z.enum(PRODUCT_TYPES, invalid).nullable().optional(),
    unit: unit.nullable().optional(),
    isVisible: z.boolean(invalid).optional(),
    isFilterable: z.boolean(invalid).optional(),
    position: position.optional(),
    options: z
      .array(existingOption)
      .max(MAX_OPTIONS, { error: 'errors.validation.maxItems' })
      .optional(),
  })
  .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type EditAttributeBody = z.infer<typeof EditAttributeSchema>

export const SetProductAttributesSchema = z.object({
  values: z
    .array(
      z.object({
        key: z.string().trim().min(1, invalid).max(40, invalid),
        value: z.union([
          z.string().max(500, { error: 'errors.validation.maxLengthString' }),
          z.number(invalid),
          z.boolean(invalid),
          z.array(z.string().max(50, invalid)).max(20, { error: 'errors.validation.maxItems' }),
        ]),
      }),
    )
    .max(100, { error: 'errors.validation.maxItems' }),
})
export type SetProductAttributesBody = z.infer<typeof SetProductAttributesSchema>
