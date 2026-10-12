/**
 * Ask the browser not to evict our IndexedDB data under storage pressure.
 * Called on every launch until granted; once granted it's a cheap no-op.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
