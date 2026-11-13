import {expect} from '@jest/globals'

type Res = { statusCode: number; json: () => any }

/** Asserts the HTTP status and the envelope `code` of a successful response. */
export const expectOk = (res: Res, status: number, code: string) => {
    expect(res.statusCode).toBe(status)
    expect(res.json().code).toBe(code)
}

/** Asserts the HTTP status and the envelope `code` of an error response. */
export const expectError = (res: Res, status: number, code: string) => {
    expect(res.statusCode).toBe(status)
    expect(res.json().code).toBe(code)
}

/** Zod/pipe validation failures: 400 + VALIDATION_ERROR. */
export const expectValidationError = (res: Res) => expectError(res, 400, 'VALIDATION_ERROR')
