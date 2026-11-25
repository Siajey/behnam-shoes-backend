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