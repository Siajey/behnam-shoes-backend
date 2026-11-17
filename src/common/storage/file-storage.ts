import { randomUUID } from 'node:crypto'

import { EXTENSION_BY_CONTENT_TYPE, normalizeContentType } from './content-types'
import { FileNotFoundError, FileTooLargeError, FileTypeNotAllowedError } from './file.errors'
import {
  IFileStorage,
  StoredObjectInfo,
  UploadPolicy,
  UploadRequest,
  UploadTarget,
} from './file-storage.interface'

export abstract class FileStorage implements IFileStorage {
  async createUploadTarget(policy: UploadPolicy, request: UploadRequest): Promise<UploadTarget> {
    const contentType = normalizeContentType(request.contentType)
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType]

    if (!extension || !policy.allowedContentTypes.includes(contentType)) {
      throw new FileTypeNotAllowedError(contentType, policy.allowedContentTypes)
    }

    if (!Number.isInteger(request.sizeBytes) || request.sizeBytes <= 0) {
      throw new FileTooLargeError(policy.maxSizeBytes)
    }
    if (request.sizeBytes > policy.maxSizeBytes) {
      throw new FileTooLargeError(policy.maxSizeBytes)
    }

    const key = FileStorage.generateKey(policy.folder, extension)
    const target = await this.presignUpload(key, { contentType, sizeBytes: request.sizeBytes })

    return { ...target, key, publicUrl: this.publicUrl(key) }
  }

  async verifyUploaded(policy: UploadPolicy, key: string): Promise<StoredObjectInfo> {
    const prefix = `${FileStorage.trimSlashes(policy.folder)}/`
    if (!key.startsWith(prefix) || key.includes('..')) {
      throw new FileNotFoundError(key)
    }

    const info = await this.head(key)
    if (!info) throw new FileNotFoundError(key)

    const contentType = info.contentType ? normalizeContentType(info.contentType) : null

    if (info.sizeBytes > policy.maxSizeBytes) {
      await this.delete(key)
      throw new FileTooLargeError(policy.maxSizeBytes)
    }

    if (!contentType || !policy.allowedContentTypes.includes(contentType)) {
      await this.delete(key)
      throw new FileTypeNotAllowedError(contentType ?? 'unknown', policy.allowedContentTypes)
    }

    return { ...info, contentType }
  }

  protected abstract presignUpload(
    key: string,
    request: UploadRequest,
  ): Promise<Omit<UploadTarget, 'key' | 'publicUrl'>>

  abstract head(key: string): Promise<StoredObjectInfo | null>
  abstract delete(key: string): Promise<void>
  abstract publicUrl(key: string): string

  private static generateKey(folder: string, extension: string): string {
    const now = new Date()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    return `${FileStorage.trimSlashes(folder)}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`
  }

  private static trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '')
  }
}
