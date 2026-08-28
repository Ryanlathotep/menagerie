/**
 * Shared file-save helpers for every export in the game (save backups, party
 * layouts, room libraries and the combined "everything" bundle).
 *
 * Two things this centralises:
 *  1. Default file names — one registry so the UI can *remind* players what a
 *     file will be called before they export it, and so importers can hint at
 *     what they expect to receive.
 *  2. A remembered save location — when the browser supports the File System
 *     Access API we ask once for a folder, keep the handle in IndexedDB, and
 *     write every later export straight into it. Browsers without it (Safari,
 *     itch.io iframes, mobile) transparently fall back to a normal download.
 */

export type ExportKind = 'bundle' | 'save' | 'partyLayouts' | 'rooms' | 'room';

const stamp = () => new Date().toISOString().slice(0, 10);

/** Human-facing description + default file name for each export kind. */
export const EXPORT_KINDS: Record<ExportKind, { label: string; describe: string; name: (extra?: string) => string }> = {
  bundle: {
    label: 'Everything bundle',
    describe: 'Save data, settings, party layouts and room library in one file.',
    name: () => `menagerie-everything-${stamp()}.json`,
  },
  save: {
    label: 'Save backup',
    describe: 'Progress + settings only.',
    name: () => `monster-roguelike-backup-${stamp()}.json`,
  },
  partyLayouts: {
    label: 'Party layouts',
    describe: 'Named party presets from Character Select.',
    name: () => `menagerie-party-layouts-${stamp()}.json`,
  },
  rooms: {
    label: 'Room library',
    describe: 'Every saved room prefab.',
    name: (extra) => `menagerie_rooms_${extra ?? 'all'}.json`,
  },
  room: {
    label: 'Single room',
    describe: 'The room currently open in the editor.',
    name: (extra) => `room_${(extra ?? 'untitled').replace(/\W+/g, '_')}.json`,
  },
};

export function defaultFileName(kind: ExportKind, extra?: string): string {
  return EXPORT_KINDS[kind].name(extra);
}

/* ── Remembered folder (File System Access API) ─────────────────────────── */

type DirHandle = FileSystemDirectoryHandle;
const DB_NAME = 'menagerie-files';
const STORE = 'handles';
const HANDLE_KEY = 'exportDir';
const NAME_KEY = 'menagerie_export_dir_name';

export function supportsFolderPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: DirHandle | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (value) store.put(value, HANDLE_KEY); else store.delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<DirHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** Friendly name of the remembered folder, for display in Settings. */
export function savedFolderName(): string | null {
  try { return localStorage.getItem(NAME_KEY); } catch { return null; }
}

/** Ask the player to choose a folder; remembered for all later exports. */
export async function chooseExportFolder(): Promise<string | null> {
  if (!supportsFolderPicker()) return null;
  const picker = (window as unknown as { showDirectoryPicker: (o?: unknown) => Promise<DirHandle> }).showDirectoryPicker;
  const handle = await picker({ id: 'menagerie-exports', mode: 'readwrite' });
  await idbSet(handle);
  try { localStorage.setItem(NAME_KEY, handle.name); } catch { /* ignore */ }
  return handle.name;
}

export async function forgetExportFolder(): Promise<void> {
  await idbSet(null);
  try { localStorage.removeItem(NAME_KEY); } catch { /* ignore */ }
}

async function writeToRememberedFolder(fileName: string, text: string): Promise<boolean> {
  const dir = await idbGet();
  if (!dir) return false;
  try {
    const perm = await (dir as unknown as {
      queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
      requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
    }).queryPermission?.({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const asked = await (dir as unknown as {
        requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
      }).requestPermission?.({ mode: 'readwrite' });
      if (asked !== 'granted') return false;
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('[files] folder write failed, falling back to download', e);
    return false;
  }
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface SaveResult { fileName: string; location: 'folder' | 'download' }

/**
 * Write JSON out under the registry's default name (or an override), into the
 * remembered folder when we have one, otherwise as a plain download.
 */
export async function saveJsonExport(
  kind: ExportKind,
  data: unknown,
  opts: { extra?: string; fileName?: string } = {},
): Promise<SaveResult> {
  const fileName = opts.fileName ?? defaultFileName(kind, opts.extra);
  const text = JSON.stringify(data, null, 2);
  const wrote = await writeToRememberedFolder(fileName, text);
  if (wrote) return { fileName, location: 'folder' };
  downloadText(fileName, text);
  return { fileName, location: 'download' };
}

/* ── The single "everything" file ───────────────────────────────────────── */

export const BUNDLE_KIND = 'menagerie_everything';
export const SAVE_KEY = 'monster-roguelike-save';
export const SETTINGS_KEY = 'monster-roguelike-settings';
export const PARTY_LAYOUTS_KEY = 'menagerie_saved_parties';
export const ROOMS_KEY = 'menagerie_rooms_v1_local';

export interface EverythingBundle {
  kind: typeof BUNDLE_KIND;
  version: 1;
  exportedAt: string;
  saveData: unknown;
  settings?: unknown;
  partyLayouts?: unknown;
  rooms?: unknown;
}

function readLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch { return undefined; }
}

/** Bundle live save data + settings with the locally cached layouts and rooms. */
export function buildEverythingBundle(saveData: unknown, settings: unknown): EverythingBundle {
  return {
    kind: BUNDLE_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    saveData,
    settings,
    partyLayouts: readLocal(PARTY_LAYOUTS_KEY) ?? [],
    rooms: readLocal(ROOMS_KEY) ?? [],
  };
}

export function isEverythingBundle(parsed: unknown): parsed is EverythingBundle {
  return !!parsed && typeof parsed === 'object' && (parsed as { kind?: string }).kind === BUNDLE_KIND;
}

/** Restore the non-save extras of a bundle. Save data is applied by the caller
 *  (it needs the game dispatch). Returns a summary for the toast. */
export function applyBundleExtras(bundle: EverythingBundle): string[] {
  const applied: string[] = [];
  try {
    if (Array.isArray(bundle.partyLayouts) && bundle.partyLayouts.length > 0) {
      localStorage.setItem(PARTY_LAYOUTS_KEY, JSON.stringify(bundle.partyLayouts));
      applied.push(`${bundle.partyLayouts.length} party layouts`);
    }
    if (Array.isArray(bundle.rooms) && bundle.rooms.length > 0) {
      localStorage.setItem(ROOMS_KEY, JSON.stringify(bundle.rooms));
      applied.push(`${bundle.rooms.length} rooms`);
    }
  } catch (e) {
    console.warn('[files] bundle extras failed', e);
  }
  return applied;
}
