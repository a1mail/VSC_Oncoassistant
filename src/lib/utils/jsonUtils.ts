export function removeEmptyFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(removeEmptyFields).filter((item) => item !== null && item !== undefined && item !== '');
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      const cleaned = removeEmptyFields(value);
      if (cleaned !== null && cleaned !== undefined && !(typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned as Record<string, unknown>).length === 0)) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}
