// Prepare a profile photo in the browser before upload. Modern phone photos are
// often 3–10 MB, well over the 2 MB the API accepts, so the image is decoded,
// orientation-corrected, scaled down and re-encoded as JPEG here. Re-encoding
// also drops EXIF metadata such as GPS location before anything leaves the
// device. The API still validates and re-encodes on its side.

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
export const MAX_EDGE = 768
export const MIN_EDGE = 16
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const PROFILE_IMAGE_ACCEPT = ACCEPTED.join(',')

export class ProfileImageError extends Error {}

/** Reasons a chosen file cannot be used, checked before any decoding. */
export function profileImageFileProblem(file: { type: string; size: number }): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Choose a JPEG, PNG, WebP or HEIC photo.'
  if (file.size === 0) return 'This file is empty. Choose another photo.'
  if (file.size > MAX_SOURCE_BYTES) return 'Choose a photo smaller than 20 MB.'
  return null
}

/** The scaled size that keeps the aspect ratio and fits within MAX_EDGE. */
export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  if (!(width > 0 && height > 0)) throw new ProfileImageError('This photo could not be read. Choose another file.')
  if (width < MIN_EDGE || height < MIN_EDGE) throw new ProfileImageError('Choose a photo of at least 16 × 16 pixels.')
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type PreparedProfileImage = { contentType: 'image/jpeg'; base64: string; bytes: number }

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function prepareProfileImage(file: File): Promise<PreparedProfileImage> {
  const problem = profileImageFileProblem(file)
  if (problem) throw new ProfileImageError(problem)
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new ProfileImageError(file.type.includes('hei') ? 'This browser cannot read HEIC photos. Choose a JPEG or PNG, or change your camera to “Most compatible”.' : 'This photo could not be read. Choose another file.') }
  try {
    const size = scaledSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width; canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ProfileImageError('Your browser could not prepare this photo. Try another browser.')
    context.fillStyle = '#ffffff' // transparent PNG areas become white rather than black in JPEG
    context.fillRect(0, 0, size.width, size.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    for (const quality of [0.86, 0.74, 0.6]) {
      const blob = await toBlob(canvas, quality)
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return { contentType: 'image/jpeg', base64: await blobToBase64(blob), bytes: blob.size }
    }
    throw new ProfileImageError('This photo is too detailed to upload. Choose another one.')
  } finally { bitmap.close() }
}
