const now = new Date()

const incrementTimestampBySeconds = (timestamp: Date, value: number) => {
  return new Date(timestamp.getTime() + value * 1000).toISOString()
}
export const getTelemetrySamples = () => [
  {
    voltage: 220.5,
    current: 15.2,
    soc: 78.5,
    timestamp: now,
  },
  {
    voltage: 950,
    current: 10,
    soc: 50,
    timestamp: incrementTimestampBySeconds(now, 5),
  },
  {
    voltage: 230,
    current: 10,
    soc: 95,
    timestamp: incrementTimestampBySeconds(now, 10),
  },
  {
    voltage: 240,
    current: 12,
    soc: 80,
    cycleCount: 5,
    timestamp: incrementTimestampBySeconds(now, 15),
  },
  {
    voltage: 380,
    current: 22,
    soc: 92,
    power: 8360,
    temperature: 45.0,
    cycleCount: 234,
    timestamp: incrementTimestampBySeconds(now, 20),
  },
]
