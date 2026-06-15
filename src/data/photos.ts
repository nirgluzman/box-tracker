import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

export interface UploadedPhoto {
  url: string // Firebase Storage download URL (stored in box.photoUrls)
  path: string // Storage path, tracked so orphaned uploads can be deleted
}

// Downscale + re-encode a photo before upload. Phone-camera shots are several
// MB, which stalls uploads on mobile; this brings them to a few hundred KB.
// Respects EXIF orientation. Falls back to the original on any failure.
async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality),
    )
    return blob ?? file
  } catch {
    return file
  }
}

// Upload one photo under boxPhotos/{docId}/ (SPEC 6.2). Compresses first.
export async function uploadBoxPhoto(docId: string, file: File): Promise<UploadedPhoto> {
  const blob = await compressImage(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg')
  const path = `boxPhotos/${docId}/${Date.now()}.${ext}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' })
  const url = await getDownloadURL(fileRef)
  return { url, path }
}

// Best-effort delete of abandoned uploads (orphaned-photo cleanup, SPEC 6.2).
export async function deletePhotoPaths(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => deleteObject(ref(storage, p)).catch(() => {})))
}

// Best-effort delete by download URL - ref() accepts a same-bucket https URL.
// Used when deleting a box, whose photoUrls are stored as download URLs (SPEC 6.3).
export async function deletePhotoUrls(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => deleteObject(ref(storage, u)).catch(() => {})))
}

// An orphaned boxPhotos/{docId}/ folder: files exist with no matching box doc.
export interface OrphanFolder {
  docId: string // folder name = the box docId the photos were uploaded under
  count: number // number of files in the folder
  thumbUrl: string | null // download URL of the first file, for a preview
}

// Scan boxPhotos/ for {docId} folders with no matching boxes document (SPEC 6.2/6.5).
// Requires a connection. liveDocIds is the set of current box document ids.
export async function listOrphanedFolders(liveDocIds: Set<string>): Promise<OrphanFolder[]> {
  const root = await listAll(ref(storage, 'boxPhotos'))
  const orphanPrefixes = root.prefixes.filter((p) => !liveDocIds.has(p.name))
  return Promise.all(
    orphanPrefixes.map(async (folder) => {
      const { items } = await listAll(folder)
      const thumbUrl = items.length ? await getDownloadURL(items[0]).catch(() => null) : null
      return { docId: folder.name, count: items.length, thumbUrl }
    }),
  )
}

// Delete every file under boxPhotos/{docId}/ (orphan cleanup, SPEC 6.5).
export async function deleteOrphanFolder(docId: string): Promise<void> {
  const { items } = await listAll(ref(storage, `boxPhotos/${docId}`))
  await Promise.all(items.map((item) => deleteObject(item).catch(() => {})))
}
