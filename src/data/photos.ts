import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage'
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
