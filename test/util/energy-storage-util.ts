import {
  CreateEnergyStorageDto,
  Performance,
  Thermal,
} from '@energy-storage/domain'
import { EnergyStorageDtoType } from '@energy-storage/presentation/dto'

export const getDummyEnergyStorage = (
  deviceId = `DEV-${Math.random().toString(36)}`,
): CreateEnergyStorageDto => {
  return {
    deviceId: deviceId,
    name: 'Lithium Ion Battery Pack',
    chemistry: 'LiFePO4',
    financial: {
      price: '1500.75',
      currency: 'USD',
    },
    media: {
      images: ['test-avatar.png'],
    },
    metadata: {
      manufacturer: 'EnergyCorp',
      model: 'EC-5000',
      serialNumber: 'SN-789012',
    },
    performance: {
      energyCapacityWh: 5000,
      nominalVoltage: 48,
      maxDischargeCurrent: 100,
      maxChargeCurrent: 50,
      roundTripEfficiency: 95.5,
      cycleLife: 2000,
      createdAt: new Date(),
    } as Performance,
    thermal: {
      coolingType: 'Liquid',
      thermalResistanceK_W: 0.05,
      thermalMassJ_K: 1200,
      createdAt: new Date(),
    } as Thermal,
  }
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInRange(min: number, max: number, decimals = 0): number {
  const value = Math.random() * (max - min) + min
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

const CHEMISTRIES = ['LiFePO4', 'NMC', 'Lead-Acid', 'NiMH']
const CURRENCIES = ['USD', 'EUR', 'GBP']
const COOLING_TYPES = ['passive', 'liquid', 'forced-air']
const MANUFACTURERS = ['Zalvolt Energy', 'VoltCore', 'GridStore Inc.']
const INSTALLATION_TYPES = ['residential', 'commercial', 'industrial']

export function generateDummyEnergyStorages(
  count: number,
  startIndex = 0,
): EnergyStorageDtoType[] {
  return Array.from({ length: count }, (_, i) => {
    const index = startIndex + i
    const paddedIndex = String(index).padStart(6, '0')

    return {
      deviceId: `ZLV-BAT-${paddedIndex}`,
      name: `Storage Unit ${String(index).padStart(3, '0')}`,
      chemistry: randomFrom(CHEMISTRIES),
      media: {
        images: [
          `https://cdn.zalvolt.com/storages/zlv-bat-${paddedIndex}/main.jpg`,
        ],
      },
      financial: {
        price: randomInRange(500, 25000, 2).toFixed(2),
        currency: randomFrom(CURRENCIES),
        lastUpdated: new Date(
          Date.now() - randomInRange(0, 90) * 24 * 60 * 60 * 1000,
        ),
      },
      metadata: {
        manufacturer: randomFrom(MANUFACTURERS),
        firmwareVersion: `${randomInRange(1, 5)}.${randomInRange(0, 9)}.${randomInRange(0, 9)}`,
        installationType: randomFrom(INSTALLATION_TYPES),
        warrantyYears: randomInRange(1, 15),
      },
      performance: {
        energyCapacityWh: randomInRange(3000, 60000),
        nominalVoltage: randomInRange(24, 450, 1),
        maxDischargeCurrent: randomInRange(20, 250),
        maxChargeCurrent: randomInRange(20, 200),
        roundTripEfficiency: randomInRange(85, 99, 1),
        cycleLife: randomInRange(1500, 10000),
      },
      thermal: {
        coolingType: randomFrom(COOLING_TYPES),
        thermalResistanceK_W: randomInRange(0.1, 1.2, 2),
        thermalMassJ_K: randomInRange(500, 10000),
      },
    }
  })
}
