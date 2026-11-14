export const DISCOUNT_KINDS = ['percent', 'fixed'] as const
export type DiscountKind = (typeof DISCOUNT_KINDS)[number]

export const isValidDiscountValue = (kind: DiscountKind, value: number): boolean =>
    Number.isInteger(value) && value >= 1 && (kind === 'fixed' || value <= 100)

export const isValidCap = (cap: number | null): boolean =>
    cap === null || (Number.isInteger(cap) && cap >= 1)

export const isValidPeriod = (startsAt: Date | null, endsAt: Date | null): boolean =>
    !startsAt || !endsAt || startsAt < endsAt

export const isWithinPeriod = (now: Date, startsAt: Date | null, endsAt: Date | null): boolean =>
    (!startsAt || startsAt <= now) && (!endsAt || now < endsAt)

export function discountAmount(kind: DiscountKind, value: number, base: number): number {
    const raw = kind === 'percent' ? Math.floor((base * value) / 100) : value
    return Math.min(Math.max(raw, 0), base)
}