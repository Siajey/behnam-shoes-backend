import { z } from 'zod'

import { PasswordSchema, UsernameSchema } from '@common/dto'

const SignUpSchema = z.object({
  email: z.email({
    error: (iss) =>
      !iss.input
        ? 'errors.validation.requiredField'
        : 'errors.validation.invalidEmail',
  }),
  username: UsernameSchema,
  password: PasswordSchema,
  confirmPassword: z.string({
    message: 'errors.validation.requiredField',
  }),
})

type SignUpSchemaType = z.infer<typeof SignUpSchema>
export { SignUpSchema, SignUpSchemaType }
