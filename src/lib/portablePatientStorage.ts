const PORTABLE_DATABASE_FILENAME = 'oncoassistant-patient-db.json';

function isStandaloneVariantPath(pathname: string): boolean {
  return /diagassist_[45]\.html?$/.test(pathname.toLowerCase());
}

export interface PortablePatientRecord {
  id?: number;
  full_name: string;
  birth_date: string;
  gender: 'male' | 'female';
  snils?: string;
  policy_number?: string;
  contact_info?: string;
  menopause_mode?: 'auto' | 'manual';
  menopause_status_manual?: 'premenopause' | 'perimenopause' | 'postmenopause' | 'unknown';
  last_menstruation_date?: string;
  bilateral_oophorectomy?: boolean;
  menopause_status?: string;
  menopause_basis?: string;
  updated_at?: string;
  latest_diagnosis?: string;
}

export interface PortableConsultationRecord {
  patient_id: number;
  data: string;
  date: string;
}

export interface PortablePatientDatabase {
  version: 1;
  savedAt: string;
  patients: PortablePatientRecord[];
  consultations: Record<string, PortableConsultationRecord>;
}

export interface PortablePatientStorageState {
  enabled: boolean;
  supported: boolean;
  selected: boolean;
  folderName: string | null;
  fileName: string;
}

interface FileSystemPermissionDescriptorLike {
  mode?: 'read' | 'readwrite';
}

interface FileSystemWritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileLike {
  text(): Promise<string>;
}

interface FileSystemFileHandleLike {
  getFile(): Promise<FileSystemFileLike>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface FileSystemDirectoryHandleLike {
  name: string;
  getFileHandle(
    name: string,
    options?: {
      create?: boolean;
    }
  ): Promise<FileSystemFileHandleLike>;
  queryPermission?(descriptor?: FileSystemPermissionDescriptorLike): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(descriptor?: FileSystemPermissionDescriptorLike): Promise<'granted' | 'denied' | 'prompt'>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
}

type PortableStorageListener = (state: PortablePatientStorageState) => void;

let selectedDirectoryHandle: FileSystemDirectoryHandleLike | null = null;
const listeners = new Set<PortableStorageListener>();

export function isDiagassist4Variant(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.protocol === 'file:'
    || isStandaloneVariantPath(window.location.pathname);
}

export function isPortablePatientStorageSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function';
}

export function getPortablePatientStorageState(): PortablePatientStorageState {
  return {
    enabled: isDiagassist4Variant(),
    supported: isPortablePatientStorageSupported(),
    selected: !!selectedDirectoryHandle,
    folderName: selectedDirectoryHandle?.name ?? null,
    fileName: PORTABLE_DATABASE_FILENAME,
  };
}

export function subscribePortablePatientStorage(
  listener: PortableStorageListener
): () => void {
  listeners.add(listener);
  listener(getPortablePatientStorageState());

  return () => {
    listeners.delete(listener);
  };
}

function notifyPortableStorageListeners(): void {
  const snapshot = getPortablePatientStorageState();
  listeners.forEach((listener) => listener(snapshot));
}

async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandleLike
): Promise<boolean> {
  if (typeof handle.queryPermission === 'function') {
    const existingPermission = await handle.queryPermission({ mode: 'readwrite' });
    if (existingPermission === 'granted') {
      return true;
    }
  }

  if (typeof handle.requestPermission === 'function') {
    const grantedPermission = await handle.requestPermission({ mode: 'readwrite' });
    return grantedPermission === 'granted';
  }

  return true;
}

/**
 * Requests a target folder for the portable patient database.
 * This runs only in the standalone HTML variant (`Diagassist_4.html` / `Diagassist_5.html`).
 */
export async function choosePortablePatientStorageDirectory(): Promise<PortablePatientStorageState> {
  if (!isDiagassist4Variant()) {
    return getPortablePatientStorageState();
  }

  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('Ваш браузер не поддерживает выбор папки. Рекомендуется Microsoft Edge или Google Chrome.');
  }

  const handle = await picker();
  const hasPermission = await ensureDirectoryPermission(handle);
  if (!hasPermission) {
    throw new Error('Нет прав на запись в выбранную папку.');
  }

  selectedDirectoryHandle = handle;
  notifyPortableStorageListeners();
  return getPortablePatientStorageState();
}

function createEmptyPortableDatabase(): PortablePatientDatabase {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    patients: [],
    consultations: {},
  };
}

async function getDatabaseFileHandle(
  create: boolean
): Promise<FileSystemFileHandleLike | null> {
  if (!selectedDirectoryHandle) {
    return null;
  }

  return selectedDirectoryHandle.getFileHandle(PORTABLE_DATABASE_FILENAME, { create });
}

/**
 * Loads the portable patient database from the selected folder.
 * Returns `null` when the standalone folder was not selected yet.
 */
export async function loadPortablePatientDatabase(): Promise<PortablePatientDatabase | null> {
  if (!isDiagassist4Variant() || !selectedDirectoryHandle) {
    return null;
  }

  const fileHandle = await getDatabaseFileHandle(true);
  if (!fileHandle) {
    return null;
  }

  const file = await fileHandle.getFile();
  const content = await file.text();
  if (!content.trim()) {
    return createEmptyPortableDatabase();
  }

  const parsed = JSON.parse(content) as Partial<PortablePatientDatabase>;
  return {
    version: 1,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    patients: Array.isArray(parsed.patients) ? parsed.patients : [],
    consultations: parsed.consultations && typeof parsed.consultations === 'object'
      ? parsed.consultations as Record<string, PortableConsultationRecord>
      : {},
  };
}

/**
 * Persists the patient database into the selected standalone folder.
 * The write is skipped when the HTML variant is not active or no folder is selected.
 */
export async function savePortablePatientDatabase(
  database: PortablePatientDatabase
): Promise<boolean> {
  if (!isDiagassist4Variant() || !selectedDirectoryHandle) {
    return false;
  }

  const fileHandle = await getDatabaseFileHandle(true);
  if (!fileHandle) {
    return false;
  }

  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify({
    ...database,
    version: 1,
    savedAt: new Date().toISOString(),
  }, null, 2));
  await writable.close();
  return true;
}
