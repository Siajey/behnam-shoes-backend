import {z} from 'zod'

import {uuidSchema} from '@common/validations'

const invalid = {error: 'errors.validation.invalidFieldValue'}
export const gatewayNameSchema = z.string().trim().regex(/^[a-z0-9_-]{1,30}$/, invalid)
export const StartPaymentSchema = z.object({orderId: uuidSchema, gateway: gatewayNameSchema.optional()})
export type StartPaymentBody = z.infer<typeof StartPaymentSchema>
