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
