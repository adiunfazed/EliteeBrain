/**
 * Stand-in for the Firebase module, so stores and screens can be exercised
 * offline — in the node tests and in the browser harnesses.
 *
 * Everything here is inert: no network, no project, no credentials. A store
 * handed `db = null` takes its local-first path, which is exactly the path
 * under test.
 */
export const db = null as any;
export const auth = null as any;

export type User = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export async function updateUserProfileName(): Promise<void> {
  /* no-op: the harness has no account to rename */
}

export async function syncProfileToCloud(): Promise<void> {}
export async function fetchProfileFromCloud(): Promise<null> {
  return null;
}
