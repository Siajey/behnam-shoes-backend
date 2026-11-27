import { ILogger } from '@common/logger'
import { IFileStorage } from '@common/storage'

export async function discardFile(
  storage: IFileStorage,
  logger: ILogger,
  key: string | null,
  module: string,
): Promise<void> {
  if (!key) return
  try {
    await storage.delete([key])
  } catch (error) {
    void logger.warn('The replaced image could not be deleted and stays in storage', {
      module,
      operation: 'discardFile',
      event: 'settings.image.discard',
      data: { key },
      err: error,
    })
  }
}
