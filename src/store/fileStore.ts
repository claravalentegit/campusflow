/**
 * Minimal IndexedDB store for files attached to resources. Files stay in this browser only.
 */
const DB = 'campusflow-files'
const STORE = 'files'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
}

export function validateFile(file: File): string | null {
  const type = file.type || (file.name.endsWith('.md') ? 'text/markdown' : '')
  if (!ALLOWED_FILE_TYPES[type]) return `“${file.name}” is not a supported type. Use PDF, image, text, Word, or PowerPoint files.`
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`
  if (file.size === 0) return `“${file.name}” is empty.`
  return null
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('File storage is not available in this browser.'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open file storage.'))
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error ?? new Error('File storage error.'))
  })
}

export const putStoredFile = (id: string, blob: Blob) => tx<IDBValidKey>('readwrite', (s) => s.put(blob, id))
export const getStoredFile = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export async function deleteStoredFile(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch {
    /* best effort */
  }
}
