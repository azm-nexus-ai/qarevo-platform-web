export type DocumentAccessLifetime = 300 | 3600

export type SecureDocumentMetadata = {
  id: string
  filename: string
  content_type: string
  file_size_bytes?: number | null
  download_url: string
  expires_in: number
  uploaded_by?: 'patient' | 'care_team' | 'unknown'
}

export type SecureDocumentAccess = {
  fileId: string
  filename: string
  contentType: string
  fileSizeBytes: number | null
  downloadUrl: string
  expiresAt: number
  uploadedBy: 'patient' | 'care_team' | 'unknown'
}

const invalidMetadata = 'Document access could not be verified. Close this dialog, refresh the requests and try again.'

/** A signed link is kept only in component memory and is never embedded or prefetched. */
export function validateDocumentAccess(value: unknown, expectedFileId: string, requestedAt: number, now = Date.now(), maxLifetimeSeconds: DocumentAccessLifetime = 300): SecureDocumentAccess {
  if ((maxLifetimeSeconds !== 300 && maxLifetimeSeconds !== 3600) || !value || typeof value !== 'object') throw new Error(invalidMetadata)
  const metadata = value as Partial<SecureDocumentMetadata>
  if (metadata.id !== expectedFileId || !expectedFileId || typeof metadata.filename !== 'string' ||
      !metadata.filename.trim() || metadata.filename.length > 300 || /[\u0000-\u001f\u007f]/.test(metadata.filename) ||
      typeof metadata.content_type !== 'string' || !/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(metadata.content_type) ||
      typeof metadata.expires_in !== 'number' || !Number.isInteger(metadata.expires_in) || metadata.expires_in <= 0 || metadata.expires_in > maxLifetimeSeconds ||
      !Number.isFinite(requestedAt) || !Number.isFinite(now) || requestedAt > now ||
      typeof metadata.download_url !== 'string' || metadata.download_url.length > 8192 || /[\u0000-\u0020\u007f]/.test(metadata.download_url)) {
    throw new Error(invalidMetadata)
  }
  let url: URL
  try { url = new URL(metadata.download_url) } catch { throw new Error(invalidMetadata) }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error(invalidMetadata)
  const expiresAt = requestedAt + metadata.expires_in * 1000
  if (expiresAt <= now) throw new Error('This document link has expired. Request fresh access.')
  const fileSize = metadata.file_size_bytes
  if (fileSize !== undefined && fileSize !== null && (!Number.isSafeInteger(fileSize) || fileSize < 0)) throw new Error(invalidMetadata)
  return {
    fileId: expectedFileId,
    filename: metadata.filename,
    contentType: metadata.content_type,
    fileSizeBytes: fileSize ?? null,
    downloadUrl: url.href,
    expiresAt,
    uploadedBy: metadata.uploaded_by === 'patient' || metadata.uploaded_by === 'care_team' ? metadata.uploaded_by : 'unknown',
  }
}

export function documentFileSize(bytes: number | null) {
  if (bytes === null) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} bytes`
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
