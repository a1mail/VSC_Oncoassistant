import { removeEmptyFields } from '@/lib/utils/jsonUtils';

export function getCustomSystemPrompt(fallback: string): string {
  try {
    const storedPrompts = localStorage.getItem('onco_prompts');
    if (storedPrompts) {
      const prompts = JSON.parse(storedPrompts);
      if (prompts.length > 0 && prompts[0].content) {
        return prompts[0].content;
      }
    }
  } catch { /* ignore corrupt localStorage */ }
  return fallback;
}

export function redactPatientPII(patientData: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...patientData };
  if (safe.patient && typeof safe.patient === 'object') {
    const p = safe.patient as Record<string, unknown>;
    safe.patient = {
      ...p,
      full_name: 'Patient X',
      phone: '[REDACTED]',
      address: '[REDACTED]',
      birth_date: typeof p.birth_date === 'string' ? p.birth_date.substring(0, 4) : 'Unknown',
    };
  }
  return removeEmptyFields(safe) as Record<string, unknown>;
}

export function appendDocumentsToPrompt(
  prompt: string,
  documents: Array<{ type?: string; name?: string; content?: string }> | undefined,
): string {
  if (!documents || documents.length === 0) return prompt;

  let result = prompt + '\n\nAttached Medical Documents:\n';
  documents.forEach((doc, index) => {
    if (doc.type === 'text') {
      result += `\n--- Document ${index + 1} (${doc.name}) ---\n${doc.content}\n`;
    } else {
      result += `\n--- Document ${index + 1} (${doc.name}) ---\n[Image Content Attached]\n`;
    }
  });
  return result;
}
