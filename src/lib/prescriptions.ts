export type NormalizedPrescription = {
  type: string;
  name: string;
  details: string;
};

export function toPrescriptionText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (Array.isArray(value)) {
    return value.map(toPrescriptionText).filter(Boolean).join('; ');
  }
  return '';
}

/**
 * Normalizes heterogeneous AI prescription payloads into a stable table/report shape.
 * This preserves clinically important fields even when different models use different keys.
 */
export function normalizePrescriptionItem(item: unknown): NormalizedPrescription | null {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return { type: 'Препарат', name: text, details: text };
  }

  if (!item || typeof item !== 'object') return null;

  const prescription = item as Record<string, unknown>;
  const type =
    toPrescriptionText(
      prescription.type || prescription.category || prescription.kind || prescription.classification,
    ) || 'Препарат';
  const name =
    toPrescriptionText(
      prescription.name ||
        prescription.drug ||
        prescription.medication ||
        prescription.medicine ||
        prescription.title,
    ) || 'Без названия';

  const detailFields = [
    ['Показание', prescription.indication],
    ['Дозировка', prescription.dosage || prescription.dose],
    ['Форма', prescription.form],
    ['Путь введения', prescription.route],
    ['Кратность', prescription.frequency],
    ['Длительность', prescription.duration],
    ['Режим', prescription.regimen],
    ['Инструкция', prescription.instructions || prescription.details],
    ['Противопоказания', prescription.contraindications],
    ['Предостережения', prescription.warnings || prescription.warning],
    ['Примечание', prescription.note || prescription.notes],
  ] as const;

  const details = detailFields
    .map(([label, value]) => {
      const text = toPrescriptionText(value);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean)
    .join('; ');

  return { type, name, details: details || name };
}

/**
 * Converts arbitrary model output for treatment prescriptions into a predictable array.
 * Supports arrays of objects, plain strings, and object maps.
 */
export function normalizePrescriptions(value: unknown): NormalizedPrescription[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizePrescriptionItem)
      .filter((item): item is NormalizedPrescription => !!item);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: 'Препарат', name: line, details: line }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([name, details]) => {
        const normalizedName = name.trim() || 'Без названия';
        const normalizedDetails = toPrescriptionText(details) || normalizedName;
        return {
          type: 'Препарат',
          name: normalizedName,
          details: normalizedDetails,
        };
      })
      .filter((item) => Boolean(item.name || item.details));
  }

  return [];
}
