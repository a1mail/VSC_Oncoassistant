const memory = new Map<string, string>();

export function isPortableSession(): boolean {
  return typeof window !== 'undefined' && (
    window.location.protocol === 'file:' ||
    /diagassist_\d+\.html?$/i.test(window.location.pathname)
  );
}

/** Portable sessions never read or persist browser storage belonging to another computer. */
export const appStorage = {
  getItem(key: string): string | null {
    if (isPortableSession()) return memory.get(key) ?? null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (isPortableSession()) { memory.set(key, value); return; }
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (isPortableSession()) { memory.delete(key); return; }
    window.localStorage.removeItem(key);
  },
};

export function clearPortableSession(): void {
  memory.clear();
}

/** Clear only this application's legacy residue, never unrelated browser data. */
export function initializeAppStorage(): void {
  if (!isPortableSession()) return;
  const keys = [
    'onco_patients', 'onco_consultations', 'onco_consultation_draft',
    'onco_ai_provider_profiles', 'ai_settings_enhanced', 'ai_settings',
    'ai_config', 'onco_prompts', 'auth_token',
  ];
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Restricted browsers can deny localStorage; portable memory still works.
  }
}
