export interface ConfigProvider {
  get(key: string): string
  getOptional(key: string): string | undefined
  getNumber?(key: string): number
}
