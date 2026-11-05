import { z } from 'zod'

import {PhoneNumberSchema} from "@common/dto";

const PasswordLessLoginSchema = z.object(
    {
        loginMethod: z.literal('otp'),
        credentials: z.object(
            {
                phoneNumber: PhoneNumberSchema,
            },
            {
                error: 'errors.validation.requiredField',
            },
        ),
    },
    {
        message: 'errors.validation.invalidPhoneNumber',
    },
)

type PasswordLessLoginSchemaType = z.infer<typeof PasswordLessLoginSchema>
export { PasswordLessLoginSchema, PasswordLessLoginSchemaType }

export const LoginSchema = z.discriminatedUnion('loginMethod', [
    PasswordLessLoginSchema,
])

export type LoginSchemaType = z.infer<typeof LoginSchema>

export const VerifyOtpSchema = z.object({
    phoneNumber: PhoneNumberSchema,
    otp: z.string({
        error: 'errors.validation.requiredField',
    }),
})

export type VerifyOtpSchemaType = z.infer<typeof VerifyOtpSchema>
