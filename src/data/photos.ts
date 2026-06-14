import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

export interface UploadedPhoto {
  url: string // Firebase Storage download URL (stored in box.photoUrls)
  path: string // Storage path, tracked so orphaned uploads can be deleted
}

// Upload one photo under boxPhotos/{docId}/ (SPEC 6.2).
export async function uploadBoxPhoto(docId: string, file: File): Promise<UploadedPhoto> {
  const path = `boxPhotos/${docId}/${Date.now()}_${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  return { url, path }
}

// Best-effort delete of abandoned uploads (orphaned-photo cleanup, SPEC 6.2).
export async function deletePhotoPaths(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => deleteObject(ref(storage, p)).catch(() => {})))
}

// Best-effort delete by download URL — ref() accepts a same-bucket https URL.
// Used when deleting a box, whose photoUrls are stored as download URLs (SPEC 6.3).
export async function deletePhotoUrls(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => deleteObject(ref(storage, u)).catch(() => {})))
}
