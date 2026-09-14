/**
 * Alarm sounds, including the user's own.
 *
 * Custom audio is stored in IndexedDB on the device rather than uploaded.
 * An alarm has to work at 6am with no network and no server round trip, and a
 * user's music is also not something worth putting on someone else's disk.
 *
 * The trade-off is that a custom sound does not follow the user to a second
 * device. That is the right way round: a built-in sound always works
 * everywhere, and the custom one degrades to a built-in rather than silence.
 */

const DB_NAME = 'elitelife_alarm_audio';
const STORE = 'sounds';
const DB_VERSION = 1;

/** Generous for a short clip, small enough not to fill a phone. */
export const MAX_SOUND_BYTES = 8 * 1024 * 1024;

export interface CustomSound {
  id: string;
  name: string;
  /** MIME type, kept so the blob can be reconstructed correctly. */
  type: string;
  size: number;
  addedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store an audio file. Returns its id. */
export async function saveCustomSound(file: File): Promise<CustomSound> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('That is not an audio file.');
  }
  if (file.size > MAX_SOUND_BYTES) {
    throw new Error('That file is too large. Use a clip under 8 MB.');
  }

  const db = await openDb();
  const id = `snd_${Date.now()}`;

  const meta: CustomSound = {
    id,
    name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Custom',
    type: file.type,
    size: file.size,
    addedAt: new Date().toISOString(),
  };

  // The blob is stored alongside its metadata so one read returns everything.
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...meta, blob: file });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return meta;
}

export async function listCustomSounds(): Promise<CustomSound[]> {
  try {
    const db = await openDb();

    const rows = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    db.close();
    // The blob is dropped here: callers listing sounds do not need the audio.
    return rows.map(({ blob, ...meta }) => meta as CustomSound);
  } catch {
    // No IndexedDB, or private mode. Built-in sounds still work.
    return [];
  }
}

/** An object URL for a stored sound, or null if it has gone. */
export async function loadCustomSoundUrl(id: string): Promise<string | null> {
  try {
    const db = await openDb();

    const row = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    db.close();
    if (!row?.blob) return null;

    return URL.createObjectURL(row.blob);
  } catch {
    return null;
  }
}

export async function deleteCustomSound(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* already gone */
  }
}

/** Custom sound ids carry a prefix so they are distinguishable from built-ins. */
export function isCustomSound(soundId: string): boolean {
  return soundId.startsWith('snd_');
}

/**
 * Play a sound on a loop until stopped.
 *
 * Falls back to the built-in tone if a custom file has been deleted or the
 * device blocks playback — an alarm that stays silent is a failure, and a
 * different sound is a far better outcome than none.
 */
export async function startAlarmSound(
  soundId: string,
  fallback: () => { stop: () => void }
): Promise<{ stop: () => void }> {
  if (!isCustomSound(soundId)) return fallback();

  const url = await loadCustomSoundUrl(soundId);
  if (!url) return fallback();

  try {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 1;
    await audio.play();

    return {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    return fallback();
  }
}
