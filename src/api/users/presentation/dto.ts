import {z} from 'zod'

import {PhoneNumberSchema} from "@common/dto";

export const ProfileAddressSchema = z.object(
    {
        street: z.string({}).max(100, {
            message: 'errors.validation.maxLengthString',
        }),
        city: z.string({}).max(100, {
            message: 'errors.validation.maxLengthString',
        }),
        province: z.string({}).max(100, {
            message: 'errors.validation.maxLengthString',
        }),
        postalCode: z.string({}).max(10, {
            message: 'errors.validation.maxLengthString',
        }),
        isDefault: z.boolean().optional(),
    },
    {
        error: 'errors.validation.address.addressAllFieldsRequired',
    },
)

export const UserProfileSchema = z.object({
    firstName: z
        .string({})
        .max(20, {
            message: 'errors.validation.maxLengthString',
        })
        .optional(),
    lastName: z
        .string({})
        .max(20, {
            message: 'errors.validation.maxLengthString',
        })
        .optional(),
    avatar: z.string({}).optional(),
    bio: z
        .string({})
        .max(200, {
            message: 'errors.validation.maxLengthString',
        })
        .optional(),
    address: ProfileAddressSchema.partial()
        .optional()
        .refine(
            (data) => {
                if (!data) return true

                const requiredFields = Object.keys(ProfileAddressSchema.shape)

                return requiredFields.every((field) => {
                    const value = data[field]
                    return value !== undefined && value !== null && value !== ''
                })
            },
            {
                message: 'errors.validation.address.addressAllFieldsRequired',
            },
        ),
})
export const CreateUserSchema = z.object(
    {
        phoneNumber: PhoneNumberSchema,
        role: z.enum(['admin', 'user'], {
            error: (iss) =>
                !iss.input
                    ? 'errors.validation.requiredField'
                    : 'errors.validation.enum.role',
        }),
        status: z.enum(['active', 'inactive', 'registered'], {
            error: (iss) =>
                !iss.input
                    ? 'errors.validation.requiredField'
                    : 'errors.validation.enum.status',
        }),
    },
    {
        error: 'errors.validation.requiredRequestBody',
    },
)

export const UpdateUserSchema = z.object({
    phoneNumber: PhoneNumberSchema.optional(),
    role: z
        .enum(['admin', 'user'], {
            error: (iss) =>
                !iss.input
                    ? 'errors.validation.requiredField'
                    : 'errors.validation.enum.role',
        })
        .optional(),
    status: z
        .enum(['active', 'inactive', 'registered'], {
            error: (iss) =>
                !iss.input
                    ? 'errors.validation.requiredField'
                    : 'errors.validation.enum.status',
        })
        .optional(),
    profile: UserProfileSchema.optional(),
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
export type UserProfileDto = z.infer<typeof UserProfileSchema>
