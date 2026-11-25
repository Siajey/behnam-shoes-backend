import { toLatinDigits } from '@common/util'

export const TRACKING_STATUSES = [
    'created',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'returned',
    'failed',
] as const
export type TrackingStatus = (typeof TRACKING_STATUSES)[number]

export const FINAL_TRACKING_STATUSES: readonly TrackingStatus[] = ['delivered', 'returned', 'failed']

export const normalizeTrackingCode = (raw: string): string => toLatinDigits(raw).replace(/\s+/g, '')

const RANK: Record<TrackingStatus, number> = {
    created: 0, picked_up: 1, in_transit: 2, out_for_delivery: 3, delivered: 4, returned: 4, failed: 4,
}

export function advanceStatus(current: TrackingStatus, next: TrackingStatus): TrackingStatus {
    if (FINAL_TRACKING_STATUSES.includes(current)) return current
    return RANK[next] >= RANK[current] ? next : current
}