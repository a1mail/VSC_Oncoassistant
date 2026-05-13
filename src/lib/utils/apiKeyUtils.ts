export function normalizeApiKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/^\uFEFF/, '');
  key = key.replace(/[\u201C\u201D\u2018\u2019]/g, (ch) =>
    ch === '\u201C' || ch === '\u201D' ? '"' : "'",
  );
  key = key.replace(/^["']|["']$/g, '');
  key = key.replace(/^(?:authorization:\s*)?bearer\s+/i, '');
  key = key.replace(/\s+/g, '');
  return key;
}
