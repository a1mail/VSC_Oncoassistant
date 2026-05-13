const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] ?? ch);
}

export function esc(value: unknown): string {
  return escapeHtml(value);
}

const PRINT_BASE_CSS = `
  body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
  h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; color: #444; border-bottom: 1px solid #eee; }
  .patient-info { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
  .label { font-weight: bold; color: #555; }
  .value { margin-top: 5px; white-space: pre-wrap; }
  .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
`;

interface PrintWindowOptions {
  title: string;
  extraCss?: string;
  bodyHtml: string;
}

export function openPrintWindow({ title, extraCss, bodyHtml }: PrintWindowOptions): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const css = PRINT_BASE_CSS + (extraCss ?? '');

  printWindow.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}<script>window.onload=function(){window.print();window.close();}<\/script></body></html>`,
  );
  printWindow.document.close();
}

export function buildPatientInfoBlock(patient: { full_name?: string; birth_date?: string } | undefined): string {
  const name = esc(patient?.full_name || 'Не указано');
  const dob = patient?.birth_date
    ? esc(new Date(patient.birth_date).toLocaleDateString('ru-RU'))
    : 'Не указано';

  return `<div class="patient-info"><div><span class="label">Пациент:</span> ${name}</div><div><span class="label">Дата рождения:</span> ${dob}</div></div>`;
}

export function buildFooter(): string {
  return `<div class="footer">Сформировано: ${esc(new Date().toLocaleDateString('ru-RU'))}</div>`;
}
