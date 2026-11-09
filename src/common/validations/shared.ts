import { z } from 'zod'

import { normalizePersianLetters } from '@common/util'

const invalid = { error: 'errors.validation.invalidFieldValue' }

export const uuidSchema = z.uuid({ error: 'errors.validation.invalidUuid' })

export const requiredText = (max: number) =>
    z
        .string({ error: 'errors.validation.requiredField' })
        .trim()
        .min(1, { error: 'errors.validation.requiredField' })
        .max(max, { error: 'errors.validation.maxLengthString' })
        .overwrite(normalizePersianLetters)

export const slugSchema = (max: number) =>
    requiredText(max)
        .toLowerCase()
        .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, invalid)

export const pageSizeSchema = z.coerce
    .number(invalid)
    .int(invalid)
    .min(1, { error: 'errors.validation.mustBePositive' })
    .max(100, invalid)

export const cursorSchema = z.string().trim().min(1, invalid).max(512, invalid)

export const isNonEmptyBody = (value: object) => Object.keys(value).length > 0