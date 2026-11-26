export interface RatingSummary {
  average: number
  count: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export const emptyRatingSummary = (): RatingSummary => ({
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
})

export const roundAverage = (value: number): number => Math.round(value * 10) / 10
