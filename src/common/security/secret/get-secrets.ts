import { ConfigProvider } from '@common/configuration'
import { SecretType } from './secret-type'

export const getVerificationSecrets = (config: ConfigProvider, type: SecretType): string[] => {
  return [config.get(`${type}_CURRENT`), config.getOptional(`${type}_PREVIOUS`)].filter(
    (secret): secret is string => Boolean(secret),
  )
}
