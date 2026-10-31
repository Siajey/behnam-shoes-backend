import { z } from 'zod'

export const UsernameSchema = z
  .string({ error: 'errors.validation.requiredField' })
  .min(5, { message: 'errors.validation.minLengthString' })
  .max(20, { message: 'errors.validation.maxLengthString' })
  .regex(/^[a-zA-Z]/, {
    message: 'errors.validation.username.startsWithLetter',
  })
  .regex(/^[a-zA-Z0-9._]+$/, {
    message: 'errors.validation.username.notAllowedCharacters',
  })
  .refine((val) => !val.includes('..'), {
    message: 'errors.validation.username.invalidCharacters',
  })

export const EmailSchema = z.string({
  error: 'errors.validation.requiredField',
})

export const PasswordSchema = z
  .string({ error: 'errors.validation.requiredField' })
  .min(8, {
    message: 'errors.validation.password.passwordLessThan8Characters',
  })
  .max(64, { message: 'errors.validation.password.passwordTooLong' })
  .regex(/[a-z]/, {
    message: 'errors.validation.password.passwordMissingLowercase',
  })
  .regex(/[A-Z]/, {
    message: 'errors.validation.password.passwordMissingUppercase',
  })
  .regex(/[0-9]/, {
    message: 'errors.validation.password.passwordMissingNumber',
  })

export const ForgotPasswordSchema = z.object({
  email: z.email({
    error: (iss) =>
      !iss.input ? 'errors.validation.requiredField' : 'errors.validation.invalidEmail',
  }),
})

export type ForgotPasswordSchemaType = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z.object({
  newPassword: PasswordSchema,
  confirmPassword: PasswordSchema,
})

export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>

export const ChangePasswordSchema = z.object({
  currentPassword: PasswordSchema,
  newPassword: PasswordSchema,
  confirmPassword: PasswordSchema,
})

export type ChangePasswordSchemaType = z.infer<typeof ChangePasswordSchema>
