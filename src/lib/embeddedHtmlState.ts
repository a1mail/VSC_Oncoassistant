import type { EnhancedAISettings } from '@/lib/providers/types';

const EMBEDDED_STATE_SCRIPT_ID = 'oncoassistant-embedded-state';
const PROVIDER_PROFILES_STORAGE_KEY = 'onco_ai_provider_profiles';
const ENHANCED_SETTINGS_STORAGE_KEY = 'ai_settings_enhanced';
const DEFAULT_STANDALONE_FILENAME = 'Diagassist_5.html';

export interface EmbeddedHtmlState {
  version: 1;
  persistedAt: string | null;
  providerProfiles: unknown[];
  enhancedAiSettings: Partial<EnhancedAISettings> | null;
}

interface WindowWithSavePicker extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept?: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

function createDefaultEmbeddedHtmlState(): EmbeddedHtmlState {
  return {
    version: 1,
    persistedAt: null,
    providerProfiles: [],
    enhancedAiSettings: null,
  };
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getEmbeddedStateScriptElement(root: ParentNode = document): HTMLScriptElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const element = root.querySelector(`#${EMBEDDED_STATE_SCRIPT_ID}`);
  return element instanceof HTMLScriptElement ? element : null;
}

export function isStandaloneHtmlFileVariant(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.location.protocol === 'file:') {
    return true;
  }

  const normalizedPath = window.location.pathname.toLowerCase();
  return /diagassist_[45]\.html?$/.test(normalizedPath);
}

export function readEmbeddedHtmlState(): EmbeddedHtmlState {
  if (typeof document === 'undefined') {
    return createDefaultEmbeddedHtmlState();
  }

  const script = getEmbeddedStateScriptElement();
  if (!script?.textContent?.trim()) {
    return createDefaultEmbeddedHtmlState();
  }

  const parsed = safeJsonParse<Partial<EmbeddedHtmlState>>(script.textContent, createDefaultEmbeddedHtmlState());
  return {
    version: 1,
    persistedAt: typeof parsed.persistedAt === 'string' ? parsed.persistedAt : null,
    providerProfiles: Array.isArray(parsed.providerProfiles) ? parsed.providerProfiles : [],
    enhancedAiSettings:
      parsed.enhancedAiSettings && typeof parsed.enhancedAiSettings === 'object'
        ? parsed.enhancedAiSettings as Partial<EnhancedAISettings>
        : null,
  };
}

export function initializeEmbeddedHtmlState(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  const embeddedState = readEmbeddedHtmlState();
  if (!embeddedState.persistedAt) {
    return;
  }

  localStorage.setItem(
    PROVIDER_PROFILES_STORAGE_KEY,
    JSON.stringify(Array.isArray(embeddedState.providerProfiles) ? embeddedState.providerProfiles : []),
  );

  if (embeddedState.enhancedAiSettings) {
    localStorage.setItem(
      ENHANCED_SETTINGS_STORAGE_KEY,
      JSON.stringify(embeddedState.enhancedAiSettings),
    );
  }
}

function getSuggestedStandaloneFileName(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_STANDALONE_FILENAME;
  }

  const fromPath = window.location.pathname.split(/[\\/]/).pop();
  if (fromPath && /\.html?$/i.test(fromPath)) {
    return fromPath;
  }

  return DEFAULT_STANDALONE_FILENAME;
}

function getCurrentEmbeddedExportState(): EmbeddedHtmlState {
  return {
    version: 1,
    persistedAt: new Date().toISOString(),
    providerProfiles: safeJsonParse<unknown[]>(localStorage.getItem(PROVIDER_PROFILES_STORAGE_KEY), []),
    enhancedAiSettings: safeJsonParse<Partial<EnhancedAISettings> | null>(
      localStorage.getItem(ENHANCED_SETTINGS_STORAGE_KEY),
      null,
    ),
  };
}

function resetRootMarkup(clonedDocument: HTMLElement): void {
  const root = clonedDocument.querySelector('#root');
  if (root) {
    root.innerHTML = '';
  }
}

function upsertEmbeddedStateScript(clonedDocument: HTMLElement, state: EmbeddedHtmlState): void {
  let script = getEmbeddedStateScriptElement(clonedDocument);
  if (!script) {
    script = document.createElement('script');
    script.id = EMBEDDED_STATE_SCRIPT_ID;
    script.type = 'application/json';

    const head = clonedDocument.querySelector('head');
    if (head) {
      head.appendChild(script);
    }
  }

  script.textContent = JSON.stringify(state, null, 2);
}

export function buildStandaloneHtmlWithEmbeddedProfiles(): string {
  if (typeof document === 'undefined') {
    throw new Error('Экспорт HTML доступен только в браузере.');
  }

  const clonedDocument = document.documentElement.cloneNode(true) as HTMLElement;
  resetRootMarkup(clonedDocument);
  upsertEmbeddedStateScript(clonedDocument, getCurrentEmbeddedExportState());

  return `<!doctype html>\n${clonedDocument.outerHTML}`;
}

async function saveViaFilePicker(content: string, suggestedName: string): Promise<boolean> {
  const pickerWindow = window as WindowWithSavePicker;
  if (typeof pickerWindow.showSaveFilePicker !== 'function') {
    return false;
  }

  const fileHandle = await pickerWindow.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'Standalone HTML file',
        accept: {
          'text/html': ['.html'],
        },
      },
    ],
  });

  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

function saveViaDownload(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportStandaloneHtmlWithEmbeddedProfiles(): Promise<'saved' | 'downloaded'> {
  const content = buildStandaloneHtmlWithEmbeddedProfiles();
  const fileName = getSuggestedStandaloneFileName();

  try {
    const saved = await saveViaFilePicker(content, fileName);
    if (saved) {
      return 'saved';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
  }

  saveViaDownload(content, fileName);
  return 'downloaded';
}

export function supportsDirectHtmlSave(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as WindowWithSavePicker).showSaveFilePicker === 'function';
}
