export interface UploadPolicy {
  folder: string
  allowedContentTypes: readonly string[]
  maxSizeBytes: number
}

export interface UploadRequest {
  contentType: string
  sizeBytes: number
}

export interface UploadTarget {
  key: string
  method: 'PUT'
  url: string
  headers: Record<string, string>
  expiresInSeconds: number
  publicUrl: string
}

export interface StoredObjectInfo {
  key: string
  sizeBytes: number
  contentType: string | null
}

export interface IFileStorage {
  createUploadTarget(policy: UploadPolicy, request: UploadRequest): Promise<UploadTarget>
  verifyUploaded(policy: UploadPolicy, key: string): Promise<StoredObjectInfo>

  head(key: string): Promise<StoredObjectInfo | null>
  delete(key: string): Promise<void>
  publicUrl(key: string): string
}
