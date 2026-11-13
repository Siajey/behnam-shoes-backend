import {randomUUID} from 'node:crypto'

/** 8 hex chars, enough to keep names/slugs unique inside one spec file. */
export const uid = () => randomUUID().replace(/-/g, '').slice(0, 8)

/** `prefix-1a2b3c4d`, a valid slug. */
export const slug = (prefix: string) => `${prefix}-${uid()}`

/** A well-formed v4 uuid that does not exist in the database. */
export const randomId = () => randomUUID()

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const omit = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
    const copy = {...obj}
    delete copy[key]
    return copy
}

export const idsOf = (items: { id: string }[]) => items.map((i) => i.id)

/* ------------------------------------------------------------------ */
/* Persian / Arabic text, written as escapes so editors cannot mangle   */
/* them. Arabic kaf/yeh must be normalised to the Persian ones.         */
/* ------------------------------------------------------------------ */

export const AR_NAME = '\u0643\u0641\u0634 \u0648\u0631\u0632\u0634\u064A' // كفش ورزشي (Arabic kaf + yeh)
export const FA_NAME = '\u06A9\u0641\u0634 \u0648\u0631\u0632\u0634\u06CC' // کفش ورزشی (Persian kaf + yeh)
export const FA_SLUG = '\u06A9\u0641\u0634-\u0648\u0631\u0632\u0634\u06CC' // کفش-ورزشی
export const AR_SLUG = '\u0643\u0641\u0634-\u0648\u0631\u0632\u0634\u064A' // Arabic variant of FA_SLUG
export const PERSIAN_FORTY_TWO = '\u06F4\u06F2' // ۴۲
export const PERSIAN_FORTY = '\u06F4\u06F0' // ۴۰
