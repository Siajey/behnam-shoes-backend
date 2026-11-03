import { z } from 'zod'

import { EmailSchema, PasswordSchema } from '@common/dto'

export const LocalLoginSchema = z.object({
  emailOrUsername: EmailSchema,
  password: PasswordSchema,
})

export type LocalLoginSchemaType = z.infer<typeof LocalLoginSchema>
