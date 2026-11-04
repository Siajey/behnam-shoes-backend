import {z} from "zod";

import {isIranianMobile} from "@common/validations";

export const PhoneNumberSchema = z
    .string({
        error: 'errors.validation.requiredField',
    })
    .refine(
        (arg) => {
            return isIranianMobile(arg)
        },
        {
            message: 'errors.validation.invalidPhoneNumber',
        },
    )